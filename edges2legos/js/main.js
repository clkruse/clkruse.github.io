/*
variables
*/
var model = undefined;
var canvas;
var currColor = '#002FFF'
var backColor = '#ffffff'
var gCanvas = document.getElementById('gCanvas');

/*
slider
*/
$("#range-slider")
    .on('input change', function() {
        $('#output').text(this.value);
        canvas.freeDrawingBrush.width = this.value;
});


/*
color pallette click events

$(document).on("click","td", function(e){
    //get the color
    const color = e.target.style.backgroundColor;
    //set the color
    currColor = color;
});
*/


/*
load the model
*/
async function start(imgName, modelPath) {
    //load the model
    model = await tf.loadGraphModel(modelPath);

    //status
    document.getElementById('status').innerHTML = 'Model Loaded';
    document.getElementById('bar').style.display = "none"
    //warm up
    populateInitImage(imgName);

    allowDrawing();
}

/*
allow drawing on canvas
*/
function allowDrawing() {
    //allow draing
    canvas.isDrawingMode = 1;

    //alow UI
    $('#clear').prop('disabled', false);

    //setup slider
    var slider = document.getElementById('range-slider');
    slider.oninput = function() {
        canvas.freeDrawingBrush.width = this.value;
    };
}

/*
clear the canvas
*/
function erase() {
    canvas.clear();
    canvas.backgroundColor = backColor;
}

/*
prepare the drawing canvas
*/
function prepareCanvas() {
    canvas = window._canvas = new fabric.Canvas('canvas');
    canvas.backgroundColor = '#ffffff';
    canvas.isDrawingMode = 1;
    canvas.freeDrawingBrush.color = "black";
    canvas.freeDrawingBrush.width = 3;
    canvas.renderAll();
    //setup listeners
    canvas.on('mouse:up', function(e) {
        const imgData = getImageData();
        const pred = predict(imgData)
        //tf.toPixels(pred, gCanvas)
        predImg = array3DToImage(pred);
        fabric.Image.fromURL(predImg.src, function(oImg) {
          canvas.add(oImg);
        });
        mousePressed = false

    });
    canvas.on('mouse:down', function(e) {
        mousePressed = true
    });
}

/*
get the current image data
*/
function getImageData() {
    //get image data according to dpi
    const dpi = window.devicePixelRatio
    const x = 0 * dpi
    const y = 0 * dpi
    const w = canvas.width * dpi
    const h = canvas.height * dpi
    const imgData = canvas.contextContainer.getImageData(x, y, w, h)
    return imgData
}

function getScaledImageData() {
    //get image data according to dpi
    const dpi = window.devicePixelRatio/2
    const x = 0 * dpi
    const y = 0 * dpi
    const w = canvas.width * dpi
    const h = canvas.height * dpi
    const imgData = canvas.contextContainer.getImageData(x, y, w, h)
    return imgData
}

/*
get the prediction
*/
function predict(imgData) {
    return tf.tidy(() => {
        //get the prediction
        const sketchTensor = preprocess(imgData);
        const gImg = model.predict(sketchTensor);
        // This is the line that controls whether the sketch should be drawn
        // over the output. The division controls the darkness of the lines
        const bothImg = tf.where(tf.lessEqual(sketchTensor, 0), tf.div(sketchTensor, 1.5), gImg)
        //post process
        const postImg = postprocess(bothImg);

        return postImg
    })
}

/*
preprocess the data
*/
function preprocess(imgData) {
    return tf.tidy(() => {
        //convert to a tensor
        const tensor = tf.browser.fromPixels(imgData).toFloat()
        //resize
        const resized = tf.image.resizeBilinear(tensor, [256, 256])

        //normalize
        const offset = tf.scalar(127.5);
        const normalized = resized.div(offset).sub(tf.scalar(1.0));

        //We add a dimension to get a batch shape
        const batched = normalized.expandDims(0)

        return batched
    })
}

/*
post process
*/
function postprocess(tensor){
     const w = canvas.width
     const h = canvas.height

     return tf.tidy(() => {
        //normalization factor
        const scale = tf.scalar(0.5);

        //unnormalize and sqeeze
        const squeezed = tensor.squeeze().mul(scale).add(scale)

        //resize to canvas size
        const resized = tf.image.resizeBilinear(squeezed, [w, h])
        return resized
    })
}

/*
predict on initial image
*/
function populateInitImage(imgName)
{
    var imgData = new Image;
    imgData.src = imgName
    imgData.onload = function () {
        const img = new fabric.Image(imgData, {
            scaleX: canvas.width / 256,
            scaleY: canvas.height / 256,
        });
        canvas.add(img)
        const pred = predict(imgData)
        //tf.toPixels(pred, gCanvas)
        predImg = array3DToImage(pred);
        fabric.Image.fromURL(predImg.src, function(oImg) {
          canvas.add(oImg);
        });
    }
}


// Converts a tf tensor into DOM img element
const array3DToImage = (tensor) => {
  const [imgWidth, imgHeight] = tensor.shape;
  var data = tensor.dataSync();
  const gCanvas = document.getElementById('gCanvas');
  gCanvas.width = imgWidth;
  gCanvas.height = imgHeight;
  const ctx = gCanvas.getContext('2d');
  var imageData = ctx.getImageData(0, 0, gCanvas.width, gCanvas.height);

  for (let i = 0; i < imgWidth * imgHeight; i += 1) {
    const j = i * 4;
    const k = i * 3;
    imageData.data[j + 0] = Math.floor(256 * data[k + 0]);
    imageData.data[j + 1] = Math.floor(256 * data[k + 1]);
    imageData.data[j + 2] = Math.floor(256 * data[k + 2]);
    imageData.data[j + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);

    // Create img HTML element from canvas
    const dataUrl = canvas.toDataURL();
    const outputImg = document.createElement('img');
    outputImg.src = dataUrl;
    outputImg.style.width = imgWidth;
    outputImg.style.height = imgHeight;
    return outputImg;
  };


/*
release resources when leaving the current page
*/
function release()
{
    if(model != undefined)
    {
        model.dispose()
    }
}
window.onbeforeunload = function (e) {
    console.log('leaving the page')
    release()
}
$('.nav-link').click(function ()
{
    release()
})
