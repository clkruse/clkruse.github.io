// Global variables
let photoData = null;
let currentPhotoDate = null;
let isLoading = false;
let page = 1;
const PHOTOS_PER_PAGE = 12;
const repoPath = window.location.pathname.split('/')[1];
const preloadedImages = new Map(); // Cache for preloaded images

async function loadPhotoData() {
    try {
        const response = await fetch('./photos.json');
        photoData = await response.json();
        
        Object.keys(photoData).forEach(date => {
            const photo = photoData[date];
            if (photo.url.startsWith('/')) {
                photo.url = photo.url.substring(1);
                if (window.location.hostname.includes('github.io')) {
                    photo.url = `/${repoPath}/${photo.url}`;
                }
            }
        });
        
        displayPhotos(true);
    } catch (error) {
        console.error('Error loading photos:', error);
    }
}

function createIntersectionObserver() {
    const options = {
        root: null,
        rootMargin: '50px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    observer.unobserve(img);
                }
            }
        });
    }, options);

    return observer;
}

function createScrollObserver() {
    const options = {
        root: null,
        rootMargin: '100px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !isLoading) {
                loadMorePhotos();
            }
        });
    }, options);

    return observer;
}

// Preload image and store in cache
function preloadImage(url) {
    if (preloadedImages.has(url)) {
        return preloadedImages.get(url);
    }

    const promise = new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });

    preloadedImages.set(url, promise);
    return promise;
}

// Get adjacent photo dates
function getAdjacentDates(currentDate) {
    const dates = Object.keys(photoData).sort();
    const currentIndex = dates.indexOf(currentDate);
    
    return {
        prev: currentIndex > 0 ? dates[currentIndex - 1] : null,
        next: currentIndex < dates.length - 1 ? dates[currentIndex + 1] : null
    };
}

// Preload adjacent images
async function preloadAdjacentImages(currentDate) {
    const { prev, next } = getAdjacentDates(currentDate);
    
    const preloadPromises = [];
    if (prev) {
        preloadPromises.push(preloadImage(photoData[prev].url));
    }
    if (next) {
        preloadPromises.push(preloadImage(photoData[next].url));
    }
    
    // Wait for preloading in background
    Promise.all(preloadPromises).catch(err => {
        console.warn('Error preloading some images:', err);
    });
}

function openModal(date, photoInfo) {
    currentPhotoDate = date;
    const modal = document.getElementById('photoModal');
    updateModalContent(date, photoInfo);
    modal.style.display = 'block';
    event.stopPropagation();
    
    // Start preloading adjacent images
    preloadAdjacentImages(date);
}

async function updateModalContent(date, photoInfo) {
    const modalContent = document.getElementById('modalContent');
    const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    // Empty the modal content while loading
    modalContent.innerHTML = '';

    try {
        // Wait for image to load (either from cache or new load)
        await preloadImage(photoInfo.url);
        
        // Create the new content with everything hidden initially
        modalContent.innerHTML = `
            <div class="modal-image-container" style="opacity: 0; transition: opacity 0.3s">
                <img src="${photoInfo.url}" alt="Photo for ${displayDate}">
                <div class="modal-text">
                    <div class="modal-date">${displayDate}</div>
                    <div class="modal-description">${photoInfo.description}</div>
                </div>
            </div>
        `;

        // Wait for the new image to be fully loaded
        const img = modalContent.querySelector('img');
        if (img.complete) {
            // Image is already loaded (probably from cache)
            modalContent.querySelector('.modal-image-container').style.opacity = '1';
        } else {
            // Wait for image to load before showing content
            await new Promise((resolve) => {
                img.onload = resolve;
            });
            modalContent.querySelector('.modal-image-container').style.opacity = '1';
        }
        
        // Start preloading adjacent images
        preloadAdjacentImages(date);
    } catch (error) {
        console.error('Error loading image:', error);
        modalContent.innerHTML = `
            <div class="error-message">Error loading image</div>
        `;
    }
}

function closeModal() {
    document.getElementById('photoModal').style.display = 'none';
    currentPhotoDate = null;
}

async function navigatePhotos(direction) {
    if (!currentPhotoDate || !photoData) return;
    
    const dates = Object.keys(photoData).sort();
    const currentIndex = dates.indexOf(currentPhotoDate);
    const newIndex = currentIndex + direction;
    
    if (newIndex >= 0 && newIndex < dates.length) {
        const newDate = dates[newIndex];
        currentPhotoDate = newDate;
        await updateModalContent(newDate, photoData[newDate]);
    }
}

function getMonthYear(date) {
    return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { 
        month: 'long',
        year: 'numeric'
    });
}

function displayPhotos(isInitialLoad = false) {
    if (isInitialLoad) {
        const content = document.getElementById('content');
        content.innerHTML = '';
    }

    // Group photos by month/year
    const photosByMonth = {};
    const allDates = Object.keys(photoData);
    
    // First, group all photos by month/year
    allDates.forEach(date => {
        const monthYear = getMonthYear(date);
        if (!photosByMonth[monthYear]) {
            photosByMonth[monthYear] = [];
        }
        photosByMonth[monthYear].push({date, ...photoData[date]});
    });

    // Sort months in descending order (newest first)
    const sortedMonths = Object.keys(photosByMonth).sort((a, b) => {
        return new Date(b) - new Date(a);
    });

    // Sort photos within each month in ascending order (1 to 31)
    sortedMonths.forEach(month => {
        photosByMonth[month].sort((a, b) => {
            return new Date(a.date) - new Date(b.date);
        });
    });

    // Handle pagination
    const startMonth = (page - 1) * PHOTOS_PER_PAGE;
    const endMonth = startMonth + PHOTOS_PER_PAGE;
    const currentPageMonths = sortedMonths.slice(startMonth, endMonth);

    const content = document.getElementById('content');
    const imageObserver = createIntersectionObserver();

    currentPageMonths.forEach(monthYear => {
        let monthSection = document.querySelector(`[data-month="${monthYear}"]`);
        let grid;

        if (!monthSection) {
            monthSection = document.createElement('div');
            monthSection.setAttribute('data-month', monthYear);
            
            const monthHeader = document.createElement('div');
            monthHeader.className = 'month-header';
            monthHeader.textContent = monthYear;
            monthSection.appendChild(monthHeader);

            grid = document.createElement('div');
            grid.className = 'photo-grid';
            monthSection.appendChild(grid);
            
            content.appendChild(monthSection);
        } else {
            grid = monthSection.querySelector('.photo-grid');
        }

        photosByMonth[monthYear].forEach(photoInfo => {
            const card = document.createElement('div');
            card.className = 'photo-card';
            const dayOfMonth = new Date(photoInfo.date + 'T00:00:00').getDate();
            
            card.innerHTML = `
                <div class="thumbnail">
                    <img data-src="${photoInfo.thumb}" alt="Photo for ${photoInfo.date}">
                </div>
                <div class="date">${dayOfMonth}</div>
            `;
            
            const img = card.querySelector('img');
            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // Transparent placeholder
            imageObserver.observe(img);
            
            card.onclick = () => openModal(photoInfo.date, photoInfo);
            grid.appendChild(card);
        });
    });

    // Add scroll observer to last card
    if (currentPageMonths.length > 0) {
        const scrollObserver = createScrollObserver();
        const lastCard = content.querySelector('.photo-card:last-child');
        if (lastCard) {
            scrollObserver.observe(lastCard);
        }
    }
}

async function loadMorePhotos() {
    isLoading = true;
    page++;
    displayPhotos();
    isLoading = false;
}

// Event Listeners
document.addEventListener('keydown', (event) => {
    if (document.getElementById('photoModal').style.display === 'block') {
        switch(event.key) {
            case 'Escape':
                closeModal();
                break;
            case 'ArrowLeft':
                navigatePhotos(-1);
                break;
            case 'ArrowRight':
                navigatePhotos(1);
                break;
        }
    }
});

// Initialize
loadPhotoData();