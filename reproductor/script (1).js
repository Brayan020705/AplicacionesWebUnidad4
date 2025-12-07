const audio = new Audio();
let playlist = [];
let currentIndex = 0;
let isPlaying = false;

let audioContext;
let analyser;
let dataArray;
let source;
let isAnalyserInitialized = false;

const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const progressBar = document.getElementById('progressBar');
const progress = document.getElementById('progress');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const songTitle = document.getElementById('songTitle');
const songArtist = document.getElementById('songArtist');
const volumeSlider = document.getElementById('volumeSlider');
const fileInput = document.getElementById('fileInput');
const playlistEl = document.getElementById('playlist');
const visualizer = document.getElementById('visualizer');
const albumArt = document.querySelector('.album-art');

let db;

function initDB() {
    const request = indexedDB.open('MusicPlayerDB', 1);
    
    request.onerror = () => {
        console.error('Error al abrir la base de datos');
    };
    
    request.onsuccess = (event) => {
        db = event.target.result;
        loadPlaylistFromDB();
    };
    
    request.onupgradeneeded = (event) => {
        db = event.target.result;
        if (!db.objectStoreNames.contains('songs')) {
            db.createObjectStore('songs', { keyPath: 'id', autoIncrement: true });
        }
    };
}

function savePlaylistToDB() {
    if (!db) return;
    
    const transaction = db.transaction(['songs'], 'readwrite');
    const objectStore = transaction.objectStore('songs');
    
    objectStore.clear();
    
    playlist.forEach(song => {
        objectStore.add(song);
    });
}

function loadPlaylistFromDB() {
    if (!db) return;
    
    const transaction = db.transaction(['songs'], 'readonly');
    const objectStore = transaction.objectStore('songs');
    const request = objectStore.getAll();
    
    request.onsuccess = (event) => {
        const songs = event.target.result;
        if (songs.length > 0) {
            playlist = songs;
            renderPlaylist();
            loadSong(0);
        }
    };
}

function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function extractAlbumArt(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const arrayBuffer = e.target.result;
            const uint8Array = new Uint8Array(arrayBuffer);
            
            let albumArtData = null;
            
            if (file.type === 'audio/mpeg' || file.name.endsWith('.mp3')) {
                albumArtData = extractMP3AlbumArt(uint8Array);
            }
            
            resolve(albumArtData);
        };
        reader.readAsArrayBuffer(file);
    });
}

function extractMP3AlbumArt(uint8Array) {
    const id3Header = String.fromCharCode(...uint8Array.slice(0, 3));
    
    if (id3Header !== 'ID3') {
        return null;
    }
    
    let offset = 10;
    const tagSize = ((uint8Array[6] & 0x7f) << 21) |
                    ((uint8Array[7] & 0x7f) << 14) |
                    ((uint8Array[8] & 0x7f) << 7) |
                    (uint8Array[9] & 0x7f);
    
    const tagEnd = offset + tagSize;
    
    while (offset < tagEnd) {
        const frameId = String.fromCharCode(...uint8Array.slice(offset, offset + 4));
        offset += 4;
        
        const frameSize = (uint8Array[offset] << 24) |
                         (uint8Array[offset + 1] << 16) |
                         (uint8Array[offset + 2] << 8) |
                         uint8Array[offset + 3];
        offset += 6;
        
        if (frameId === 'APIC') {
            let pos = offset;
            pos++;
            
            while (uint8Array[pos] !== 0) pos++;
            pos++;
            pos++;
            
            while (uint8Array[pos] !== 0) pos++;
            pos++;
            
            const imageData = uint8Array.slice(pos, offset + frameSize);
            const blob = new Blob([imageData], { type: 'image/jpeg' });
            return URL.createObjectURL(blob);
        }
        
        offset += frameSize;
    }
    
    return null;
}

initDB();

const numberOfBars = 30;
for (let i = 0; i < numberOfBars; i++) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = '5px';
    visualizer.appendChild(bar);
}

function initAudioAnalyser() {
    if (isAnalyserInitialized) return;
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    source = audioContext.createMediaElementSource(audio);
    
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    
    isAnalyserInitialized = true;
}

fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    
    const newSongs = await Promise.all(files.map(async file => {
        const base64 = await convertFileToBase64(file);
        const albumArtUrl = await extractAlbumArt(file);
        return {
            name: file.name.replace(/\.[^/.]+$/, ""),
            url: base64,
            albumArt: albumArtUrl
        };
    }));
    
    playlist = [...playlist, ...newSongs];
    savePlaylistToDB();
    renderPlaylist();
    
    if (playlist.length === newSongs.length) {
        loadSong(0);
    }
});

function renderPlaylist() {
    playlistEl.innerHTML = '';
    playlist.forEach((song, index) => {
        const item = document.createElement('div');
        item.className = 'playlist-item';
        if (index === currentIndex) item.classList.add('active');
        item.innerHTML = `
            <span class="playlist-item-name">${song.name}</span>
            <span class="delete-btn" data-index="${index}">🗑️</span>
        `;
        item.querySelector('.playlist-item-name').addEventListener('click', () => {
            loadSong(index);
            play();
        });
        item.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSong(index);
        });
        playlistEl.appendChild(item);
    });
}

function deleteSong(index) {
    playlist.splice(index, 1);
    savePlaylistToDB();
    
    if (playlist.length === 0) {
        pause();
        songTitle.textContent = 'Selecciona una canción';
        songArtist.textContent = 'Sin artista';
        albumArt.innerHTML = '🎵';
        albumArt.style.backgroundImage = 'none';
        currentIndex = 0;
    } else {
        if (currentIndex >= playlist.length) {
            currentIndex = playlist.length - 1;
        }
        loadSong(currentIndex);
    }
    
    renderPlaylist();
}

function loadSong(index) {
    if (playlist.length === 0) return;
    currentIndex = index;
    audio.src = playlist[index].url;
    songTitle.textContent = playlist[index].name;
    songArtist.textContent = `Canción ${index + 1} de ${playlist.length}`;
    
    if (playlist[index].albumArt) {
        albumArt.innerHTML = '';
        albumArt.style.backgroundImage = `url(${playlist[index].albumArt})`;
        albumArt.style.backgroundSize = 'cover';
        albumArt.style.backgroundPosition = 'center';
    } else {
        albumArt.innerHTML = '🎵';
        albumArt.style.backgroundImage = 'none';
    }
    
    renderPlaylist();
}

function play() {
    if (!isAnalyserInitialized) {
        initAudioAnalyser();
    }
    
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    audio.play();
    isPlaying = true;
    playPauseBtn.textContent = '⏸';
    animateVisualizer();
}

function pause() {
    audio.pause();
    isPlaying = false;
    playPauseBtn.textContent = '▶';
}

playPauseBtn.addEventListener('click', () => {
    if (playlist.length === 0) {
        alert('Por favor, carga canciones primero');
        return;
    }
    isPlaying ? pause() : play();
});

prevBtn.addEventListener('click', () => {
    currentIndex = currentIndex > 0 ? currentIndex - 1 : playlist.length - 1;
    loadSong(currentIndex);
    if (isPlaying) play();
});

nextBtn.addEventListener('click', () => {
    currentIndex = currentIndex < playlist.length - 1 ? currentIndex + 1 : 0;
    loadSong(currentIndex);
    if (isPlaying) play();
});

audio.addEventListener('ended', () => {
    nextBtn.click();
});

audio.addEventListener('timeupdate', () => {
    const percent = (audio.currentTime / audio.duration) * 100;
    progress.style.width = percent + '%';
    currentTimeEl.textContent = formatTime(audio.currentTime);
});

audio.addEventListener('loadedmetadata', () => {
    durationEl.textContent = formatTime(audio.duration);
});

progressBar.addEventListener('click', (e) => {
    const width = progressBar.clientWidth;
    const clickX = e.offsetX;
    const duration = audio.duration;
    audio.currentTime = (clickX / width) * duration;
});

volumeSlider.addEventListener('input', (e) => {
    audio.volume = e.target.value / 100;
});
audio.volume = 0.7;

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function animateVisualizer() {
    if (!isPlaying) return;
    
    analyser.getByteFrequencyData(dataArray);
    
    const bars = document.querySelectorAll('.bar');
    
    bars.forEach((bar, index) => {
        const dataIndex = Math.floor((index / numberOfBars) * dataArray.length);
        const value = dataArray[dataIndex];
        const height = (value / 255) * 50 + 5;
        bar.style.height = height + 'px';
    });
    
    requestAnimationFrame(animateVisualizer);
}

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        playPauseBtn.click();
    }
    if (e.code === 'ArrowLeft') prevBtn.click();
    if (e.code === 'ArrowRight') nextBtn.click();
});