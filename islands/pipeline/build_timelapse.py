"""Raw reflectance arrays → stretched, color-corrected H.264 MP4 + poster JPG."""

from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

VIDEO_FPS = 10
VIDEO_CRF = 22

# Grid-thumb encode: smaller, lower-bitrate variant served in the homepage
# grid. Full-res video is reserved for the lightbox.
THUMB_SIZE = 400
THUMB_CRF = 26

POSTER_QUALITY = 80

# Per-frame Dark Object Subtraction: subtract each frame's low percentile as
# its atmospheric haze floor before the global stretch. 0 disables.
DOS_PCT = 1.0

# Percentile stretch. Pulled from the time-stack (not the median) so new
# construction that only exists in recent frames shows up in `hi`, and hi
# is set high enough that bright surfaces sit in the middle of the range
# with room to resolve fine detail instead of piling up at the cap.
STRETCH_LO_PCT = 0.5
STRETCH_HI_PCT = 99.99
# Minimum hi anchor. Open-water-only scenes have max reflectance well below
# 2500 (~25% reflectance). Clamping hi prevents the auto-stretch from blowing
# their narrow dynamic range up to full 0-255.
STRETCH_HI_FLOOR = 2500.0

# Mode-specific tonal parameters. Tuning notes:
#   - saturation: >1 emphasises blues that define water/reef colour. Gets
#     distracting fast; 1.2-1.4 is a subtle pop, >=1.5 reads as over-vivid.
#   - s_curve: 0 = no extra contrast, 1 = full smoothstep (crushes darks,
#     lifts highlights). Stronger on soft-path scenes because they need the
#     contrast to separate water from reef.
#   - bp: black point crush (hard knee). Removes residual haze; too high
#     and shadows clip abruptly.
_MODE_PARAMS = {
    "soft":   {"gamma": 0.80, "saturation": 1.30, "s_curve": 0.80, "bp": 0.00},
    "mid":    {"gamma": 0.75, "saturation": 1.20, "s_curve": 0.00, "bp": 0.03},
    "normal": {"gamma": 0.55, "saturation": 1.20, "s_curve": 0.00, "bp": 0.06},
}

# Three scene modes based on hi_raw.max:
#   hi < SOFT:   dark-dominant (water-only or thin-rim reef). Full S-curve,
#                mild gamma, no BP. Prevents deep-water noise marble.
#   SOFT <= hi < MID: reef-dominant with some built-up area. Partial S-curve
#                for contrast punch without over-crushing.
#   hi >= MID:   bright-feature scene (substantial concrete/sand). Original
#                aggressive pipeline (gamma 0.4 + BP 0.15) gives the full pop.
SOFT_PIPELINE_HI_THRESHOLD = 4500.0
MID_PIPELINE_HI_THRESHOLD = 8000.0
STRETCH_GAMMA = 0.4  # <1 lifts shadows/midtones
SATURATION = 1.5     # >1 boosts chroma around luminance (keeps highlight info)

# After gamma/saturation/normalize/smooth: anything below BLACK_POINT clips
# to 0 and the rest re-stretches to fill [0, 1]. Kills residual haze that
# gamma lift can't remove (since gamma lifts EVERYTHING).
BLACK_POINT = 0.15

# Final uint8 range. OUT_HI < 255 leaves headroom so bright surfaces never
# saturate to pure white; OUT_LO gives deep blacks.
OUT_LO = 0
OUT_HI = 245

STABLE_PIXEL_PERCENTILE = 60  # pixels below this time-std percentile count as stable
ROLLING_WINDOW = 3            # odd int; 1 = no smoothing, 3 = ±1 period triangular


def _load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (
        "/System/Library/Fonts/Supplemental/Menlo.ttc",
        "/System/Library/Fonts/Menlo.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def label_frame(img: Image.Image, label: str) -> Image.Image:
    out = img.convert("RGB").copy()
    draw = ImageDraw.Draw(out)
    font = _load_font(max(14, img.width // 28))
    pad = max(6, img.width // 80)
    bbox = draw.textbbox((0, 0), label, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = pad
    y = out.height - th - pad * 2
    draw.rectangle(
        [x - pad // 2, y - pad // 2, x + tw + pad // 2, y + th + pad],
        fill=(0, 0, 0, 160),
    )
    draw.text((x, y), label, fill=(255, 255, 255), font=font)
    return out


def process_frames(raw_arrays: list[np.ndarray]) -> list[np.ndarray]:
    """
    Raw reflectance (float32, may contain NaN) → display-ready uint8.

    Runs the full pipeline in float32 with no intermediate clipping so
    brightness excursions don't get silently flattened at 255 before the
    final output scale. Steps:
      1. Dark Object Subtraction: per-frame per-channel haze floor subtract.
      2. Stack-wide percentile stretch (lo=p0.5, hi=p99.99).
      3. Gamma (<1 lifts shadows, keeps highlights linear for detail).
      4. Saturation boost around luminance (chroma up, highlights untouched).
      5. Per-frame mean-match over stable pixels (removes residual per-frame
         atmospheric drift after DOS).
      6. Triangular rolling-window smooth over time.
      7. Black-point crush (final dehaze).
      8. Scale to [OUT_LO, OUT_HI] uint8.
    """
    stack = np.stack(raw_arrays).astype(np.float32)

    if DOS_PCT is not None and DOS_PCT > 0:
        for i in range(len(stack)):
            flat = stack[i].reshape(-1, 3)
            dark = np.nanpercentile(flat, DOS_PCT, axis=0)
            stack[i] = np.maximum(stack[i] - dark, 0.0)

    flat = stack.reshape(-1, 3)
    valid = ~(np.isnan(flat).any(axis=-1) | (np.nansum(flat, axis=-1) == 0))
    valid_flat = flat[valid]
    lo = np.percentile(valid_flat, STRETCH_LO_PCT, axis=0)
    hi_raw = np.percentile(valid_flat, STRETCH_HI_PCT, axis=0)
    hi = np.maximum(hi_raw, STRETCH_HI_FLOOR)
    rng = np.maximum(hi - lo, 1e-6)
    hi_top = float(hi_raw.max())
    if hi_top < SOFT_PIPELINE_HI_THRESHOLD:
        mode = "soft"
    elif hi_top < MID_PIPELINE_HI_THRESHOLD:
        mode = "mid"
    else:
        mode = "normal"

    stack = np.nan_to_num(stack, nan=0.0)
    x = np.clip((stack - lo) / rng, 0.0, 1.0)

    params = _MODE_PARAMS[mode]
    gamma = params["gamma"]
    if gamma != 1.0:
        x = np.power(x, gamma)

    saturation = params["saturation"]
    if saturation != 1.0:
        lum = 0.299 * x[..., 0:1] + 0.587 * x[..., 1:2] + 0.114 * x[..., 2:3]
        x = np.clip(lum + saturation * (x - lum), 0.0, 1.0)

    # Mean-matching over stable pixels, in float (no intermediate clip).
    ref = np.median(x, axis=0)
    pixel_var = x.std(axis=0).mean(axis=-1)
    stable_idx = (pixel_var <= np.percentile(pixel_var, STABLE_PIXEL_PERCENTILE)).reshape(-1)
    ref_mean = ref.reshape(-1, 3)[stable_idx].mean(axis=0)
    for i in range(len(x)):
        f_mean = x[i].reshape(-1, 3)[stable_idx].mean(axis=0)
        x[i] = x[i] - f_mean + ref_mean

    if ROLLING_WINDOW > 1:
        if ROLLING_WINDOW % 2 == 0:
            raise ValueError("ROLLING_WINDOW must be odd")
        half = ROLLING_WINDOW // 2
        w = np.array(
            [half + 1 - abs(i - half) for i in range(ROLLING_WINDOW)], dtype=np.float32
        )
        w = (w / w.sum()).reshape(-1, 1, 1, 1)
        padded = np.concatenate(
            [np.repeat(x[:1], half, axis=0), x, np.repeat(x[-1:], half, axis=0)],
            axis=0,
        )
        smoothed = np.empty_like(x)
        for i in range(len(x)):
            smoothed[i] = (padded[i : i + ROLLING_WINDOW] * w).sum(axis=0)
        x = smoothed

    strength = params["s_curve"]
    if strength > 0:
        s = 3.0 * x * x - 2.0 * x * x * x
        x = (1.0 - strength) * x + strength * s
    bp = params["bp"]
    if bp > 0:
        x = np.clip((x - bp) / (1.0 - bp), 0.0, None)

    out_span = OUT_HI - OUT_LO
    return list(np.clip(x * out_span + OUT_LO, 0, 255).astype(np.uint8))


def _encode_mp4(labeled: list[Image.Image], out_path: Path) -> None:
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        for i, img in enumerate(labeled):
            img.save(td_path / f"f_{i:05d}.png")
        cmd = [
            "ffmpeg", "-y", "-loglevel", "error",
            "-framerate", str(VIDEO_FPS),
            "-i", str(td_path / "f_%05d.png"),
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-crf", str(VIDEO_CRF),
            "-preset", "medium",
            "-movflags", "+faststart",
            # Every frame a keyframe so the lightbox scrubber can seek to any
            # month without waiting for the next GOP boundary.
            "-g", "1",
            "-keyint_min", "1",
            "-sc_threshold", "0",
            # Even dimensions (defensive; 500x500 is already even).
            "-vf", "scale=ceil(iw/2)*2:ceil(ih/2)*2",
            str(out_path),
        ]
        subprocess.run(cmd, check=True)


def _encode_mp4_thumb(full_res_mp4: Path, out_path: Path) -> None:
    """Smaller, grid-sized re-encode. Seeking isn't needed here (grid tiles
    autoplay-loop), so we drop the all-I GOP and use a standard CRF ladder."""
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(full_res_mp4),
        "-vf", f"scale={THUMB_SIZE}:{THUMB_SIZE}:flags=lanczos",
        "-c:v", "libx264",
        "-preset", "slow",
        "-crf", str(THUMB_CRF),
        "-profile:v", "high",
        "-pix_fmt", "yuv420p",
        "-r", str(VIDEO_FPS),
        "-an",
        "-movflags", "+faststart",
        str(out_path),
    ]
    subprocess.run(cmd, check=True)


def build(
    frames: list[tuple[str, np.ndarray]],
    video_out: Path,
    video_thumb_out: Path,
    poster_out: Path,
) -> None:
    """
    frames: list of (label, raw_float32_array) in chronological order.
    Writes the full-res H.264 MP4, the grid-thumb MP4, and a WebP poster.
    """
    if not frames:
        raise ValueError("no frames supplied")
    raw_arrays = [arr for _, arr in frames]
    processed = process_frames(raw_arrays)
    # Date label is no longer burned in; the site overlays a JS-driven year
    # label on each grid tile instead (see app.js .tile-year). label_frame()
    # is left defined above for callers that want it back.
    images = [Image.fromarray(arr).convert("RGB") for arr in processed]
    for p in (video_out, video_thumb_out, poster_out):
        p.parent.mkdir(parents=True, exist_ok=True)
    _encode_mp4(images, video_out)
    _encode_mp4_thumb(video_out, video_thumb_out)
    images[-1].save(poster_out, format="WEBP", quality=POSTER_QUALITY, method=6)
