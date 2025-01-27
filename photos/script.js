let photoData = null;
let currentPhotoDate = null;
let isLoading = false;
let page = 1;
const PHOTOS_PER_PAGE = 12;
const repoPath = window.location.pathname.split('/')[1];

async function loadPhotoData() {
    try {
        const response = await fetch('./photos.json');
        photoData = await response.json();
        
        // Process photo URLs
        Object.keys(photoData).forEach(date => {
            const photo = photoData[date];
            if (photo.url.startsWith('/')) {
                photo.url = photo.url.substring(1);
                if (window.location.hostname.includes('github.io')) {
                    photo.url = `/${repoPath}/${photo.url}`;
                }
            }
        });
        
        displayPhotos(true); // true indicates initial load
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

function openModal(date, photoInfo) {
    currentPhotoDate = date;
    const modal = document.getElementById('photoModal');
    updateModalContent(date, photoInfo);
    modal.style.display = 'block';
    event.stopPropagation();
}

function updateModalContent(date, photoInfo) {
    const modalContent = document.getElementById('modalContent');
    const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    modalContent.innerHTML = `
        <img src="${photoInfo.url}" alt="Photo for ${displayDate}">
        <div class="modal-date">${displayDate}</div>
        <div class="modal-description">${photoInfo.description}</div>
    `;
}

function closeModal() {
    document.getElementById('photoModal').style.display = 'none';
    currentPhotoDate = null;
}

function navigatePhotos(direction) {
    if (!currentPhotoDate || !photoData) return;
    
    const dates = Object.keys(photoData).sort();
    const currentIndex = dates.indexOf(currentPhotoDate);
    const newIndex = currentIndex + direction;
    
    if (newIndex >= 0 && newIndex < dates.length) {
        const newDate = dates[newIndex];
        currentPhotoDate = newDate;
        updateModalContent(newDate, photoData[newDate]);
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