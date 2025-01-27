let photoData = null;
const repoPath = window.location.pathname.split('/')[1];

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
        
        displayPhotos();
    } catch (error) {
        console.error('Error loading photos:', error);
    }
}

function openModal(date, photoInfo) {
    const modal = document.getElementById('photoModal');
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
    modal.style.display = 'block';
    event.stopPropagation();
}

function closeModal() {
    document.getElementById('photoModal').style.display = 'none';
}

function displayPhotos() {
    const content = document.getElementById('content');
    content.innerHTML = '';

    const photosByMonth = {};
    Object.entries(photoData).forEach(([date, data]) => {
        const monthYear = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { 
            month: 'long',
            year: 'numeric'
        });
        if (!photosByMonth[monthYear]) {
            photosByMonth[monthYear] = [];
        }
        photosByMonth[monthYear].push({date, ...data});
    });

    const sortedMonths = Object.keys(photosByMonth).sort((a, b) => 
        new Date(b) - new Date(a)
    );

    sortedMonths.forEach(monthYear => {
        const monthSection = document.createElement('div');
        
        const monthHeader = document.createElement('div');
        monthHeader.className = 'month-header';
        monthHeader.textContent = monthYear;
        monthSection.appendChild(monthHeader);

        const grid = document.createElement('div');
        grid.className = 'photo-grid';

        const sortedPhotos = photosByMonth[monthYear].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );

        sortedPhotos.forEach(photoInfo => {
            const card = document.createElement('div');
            card.className = 'photo-card';
            const dayOfMonth = new Date(photoInfo.date + 'T00:00:00').getDate();
            card.innerHTML = `
                <div class="thumbnail">
                    <img src="${photoInfo.thumb}" alt="Photo for ${photoInfo.date}">
                </div>
                <div class="date">${dayOfMonth}</div>
            `;
            card.onclick = () => openModal(photoInfo.date, photoInfo);
            grid.appendChild(card);
        });

        monthSection.appendChild(grid);
        content.appendChild(monthSection);
    });
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeModal();
    }
});

loadPhotoData(); 