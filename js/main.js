// DOM Elements
const videoFeed = document.getElementById('videoFeed');
const detectionOverlay = document.getElementById('detectionOverlay');
const detectionLog = document.getElementById('detectionLog');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const recordBtn = document.getElementById('recordBtn');
const downloadBtn = document.getElementById('downloadBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const errorModal = document.getElementById('errorModal');
const errorMessage = document.getElementById('errorMessage');
const closeErrorBtn = document.getElementById('closeErrorBtn');
const closeErrorModalBtn = document.getElementById('closeErrorModalBtn');
const clearLogBtn = document.getElementById('clearLogBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');

// Stats Elements
const fireCount = document.getElementById('fireCount');
const confidenceLevel = document.getElementById('confidenceLevel');
const processingFps = document.getElementById('processingFps');

// Global Variables
let stream = null;
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let isPaused = true;
let totalFireDetections = 0;
let lastFrameTime = Date.now();
let frameCount = 0;
let isDetecting = false;

// Initialize canvas context
const ctx = detectionOverlay.getContext('2d');

// Settings
let settings = {
    sensitivity: 50,
    alertSound: false,
    detectionMode: 'standard'
};

// Initialize the application
async function init() {
    try {
        // Request camera access
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        
        // Set video source
        videoFeed.srcObject = stream;
        await videoFeed.play();
        
        // Set canvas size to match video
        detectionOverlay.width = videoFeed.videoWidth;
        detectionOverlay.height = videoFeed.videoHeight;
        
        // Enable buttons
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        recordBtn.disabled = false;
        
        console.log('Camera initialized successfully');
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize camera. Please check your camera permissions.');
    }
}

// Perform real-time detection
async function detectFrame() {
    if (!isPaused && videoFeed.videoWidth > 0) {
        try {
            // Create a temporary canvas to capture the current frame
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = videoFeed.videoWidth;
            tempCanvas.height = videoFeed.videoHeight;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(videoFeed, 0, 0);

            // Convert canvas to blob
            const blob = await new Promise(resolve => {
                tempCanvas.toBlob(resolve, 'image/jpeg');
            });

            // Create form data
            const formData = new FormData();
            formData.append('file', blob);

            // Send request to our proxy server
            const response = await fetch('/detect', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Detection request failed');
            }

            const result = await response.json();
            
            // Clear previous detections
            ctx.clearRect(0, 0, detectionOverlay.width, detectionOverlay.height);

            // Process detections
            if (result && result.predictions) {
                result.predictions.forEach(prediction => {
                    if (prediction.confidence > settings.sensitivity / 100) {
                        drawDetection(
                            prediction.x,
                            prediction.y,
                            prediction.width,
                            prediction.height,
                            prediction.confidence * 100,
                            prediction.class
                        );
                        addDetectionLog(prediction.confidence * 100, prediction.class);
                        updateStats(prediction.confidence * 100);

                        // Play alert sound if enabled
                        if (settings.alertSound) {
                            playAlertSound();
                        }
                    }
                });
            }

            // Update FPS
            frameCount++;
            const now = Date.now();
            if (now - lastFrameTime >= 1000) {
                processingFps.textContent = frameCount;
                frameCount = 0;
                lastFrameTime = now;
            }

            // Request next frame if still detecting
            if (isDetecting) {
                requestAnimationFrame(detectFrame);
            }
        } catch (error) {
            console.error('Detection error:', error);
            if (isDetecting) {
                requestAnimationFrame(detectFrame);
            }
        }
    } else if (isDetecting) {
        requestAnimationFrame(detectFrame);
    }
}

// Draw detection box on canvas
function drawDetection(x, y, width, height, confidence, label) {
    // Calculate actual coordinates
    const actualX = x * detectionOverlay.width;
    const actualY = y * detectionOverlay.height;
    const actualWidth = width * detectionOverlay.width;
    const actualHeight = height * detectionOverlay.height;
    
    // Draw rectangle
    ctx.strokeStyle = label.toLowerCase().includes('fire') ? 'red' : 'orange';
    ctx.lineWidth = 2;
    ctx.strokeRect(actualX, actualY, actualWidth, actualHeight);

    // Draw label
    const labelText = `${label}: ${confidence.toFixed(1)}%`;
    ctx.fillStyle = label.toLowerCase().includes('fire') ? 'red' : 'orange';
    ctx.fillRect(actualX, actualY - 25, ctx.measureText(labelText).width + 10, 25);
    ctx.fillStyle = 'white';
    ctx.font = '16px Inter';
    ctx.fillText(labelText, actualX + 5, actualY - 5);
}

// Add detection to log
function addDetectionLog(confidence, label) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    const isFireDetection = label.toLowerCase().includes('fire');
    
    logEntry.className = `${isFireDetection ? 'bg-red-50' : 'bg-orange-50'} rounded-lg p-3 border ${isFireDetection ? 'border-red-100' : 'border-orange-100'}`;
    logEntry.innerHTML = `
        <div class="flex items-center justify-between">
            <span class="${isFireDetection ? 'text-red-500' : 'text-orange-500'} font-semibold">${label} Detected</span>
            <span class="text-gray-500 text-sm">${timestamp}</span>
        </div>
        <div class="mt-1 text-sm text-gray-600">
            Confidence: ${confidence.toFixed(1)}%
        </div>
    `;
    detectionLog.insertBefore(logEntry, detectionLog.firstChild);
    totalFireDetections++;
}

// Update statistics
function updateStats(confidence) {
    fireCount.textContent = totalFireDetections;
    confidenceLevel.textContent = `${confidence.toFixed(1)}%`;
}

// Play alert sound
function playAlertSound() {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZRA0PVqzn77BdGAg+ltryxnMpBSl+zPLaizsIGGS57OihUBELTKXh8bllHgU2jdXzzn0vBSF1xe/glEILElyx6OyrWBUIQ5zd8sFuJAUuhM/z1YU2Bhxqvu7mnEYODlOq5O+zYBoGPJPY88p2KwUme8rx3I4+CRZiturqpVITC0mi4PK8aB8GM4nU8tGAMQYfcsLu45ZFDBFZr+ftrVoXCECY3PLEcSYELIHO8diJOQgZaLvt559NEAxPqOPwtmMcBjiP1/PMeS0GI3fH8N2RQAoUXrTp66hVFApGnt/yv2wiBDCG0fPTgzQHHG/A7eSaSw0PVqzl77BeGQc9ltrzxnUoBSh9y/HajDsIF2W56+mjUREKTKPi8blnHgU1jdTy0HwvBSJ1xe/glEQKElyx6OyrWRUIRJzd8sFuJAUug8/z1oU2Bhxqvu3mnEgNDVKq5O+zYRsGPJLZ88p3KgUmfMrx3I4+CRVht+rqpVMSC0mh4PK8aiAFM4nU8tGAMQYfccLv45dGCxFZr+ftrVwWCECY3PLEcSYELH/N8diJOQgZZ7zs56BODwxPqOPxtmQcBjiP1/PMeS0GI3bH8d+RQQkUXrTp66hWEwlGnt/yv2wiBDCG0fPTgzQHHG3B7eSaSw0PVqzl77BeGQc9ldrzxnUoBSh9y/HajDwIF2W56+mjUREKTKPi8blnHgU1jdTy0HwvBSF2xe/glUQKElyx6OyrWRUIRJzd8sFuJAUug8/z1oU2BhxpvuznokgNDVKp5e+zYRsGPJLZ88p3KgUmfMrx3I4+CRVht+rqpVMSC0mh4PK8aiAFM4nU8tGAMQYfccLv45dGCxFYr+jtrVwWCECY3PLEcSYELH/N8diJOQgZZ7zs56BODwxPqOPxtmQcBjiP1/PMeS0GI3bH8d+RQQkUXrTp66hWEwlGnt/yv2wiBDCG0fPTgzQHHG3B7eSaSw0PVqzl77BeGQc9ldrzxnUoBSh9y/HajDwIF2W56+mjUREKTKPi8blnHgU1jdTy0HwvBSF2xe/glUQKElyx6OyrWRUIRJzd8sFuJAUug8/z1oU2BhxpvuznokgNDVKp5e+zYRsGPJLZ88p3KgUmfMrx3I4+CRVht+rqpVMSC0mh4PK8aiAFMojU89GAMQYfccLv45dGCxFYr+jtrVwWCECY3PLEcSYELH/N8diJOQgZZ7zs56BODwxPqOPxtmQcBjiP1/PMeS0GI3bH8d+RQQkUXrTp66hWEwlGnt/yv2wiBDCG0fPUgzQHHG3B7eSaSw0PVqzl77BeGQc9ldrzxnUoBSh9y/HajDwIF2W56+mjUREKTKPi8blnHgU1jdTy0HwvBSF2xe/glUQKElyx6OyrWRUIRJzd8sFuJAUug8/z1oU2BhxpvuznokgNDVKp5e+zYRsGPJLZ88p3KgUmfMrx3I4+CRVht+rqpVMSC0mh4PK8aiAFMojU89GAMQYfccLv45dGCxFYr+jtrVwWCECY3PLEcSYELH/N8diJOQgZZ7zs56BODwxPqOPxtmQcBjiP1/PMeS0GI3bH8d+RQQkUXrTp66hWEwlGnt/yv2wiBDCG0fPUgzQHHG3B7eSaSw0PVqzl77BeGQc9ldrzxnUoBSh9y/HajDwIF2W56+mjUREKTKPi8blnHgU1jdTy0HwvBSF2xe/glUQKElyx6OyrWRUIRJzd8sFuJAUs');
    audio.play();
}

// Start detection
function startDetection() {
    if (!stream) {
        showError('Camera not initialized. Please refresh the page and allow camera access.');
        return;
    }
    
    isPaused = false;
    isDetecting = true;
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    detectFrame();
}

// Recording functions
function startRecording() {
    if (!isRecording && stream) {
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.start();
        isRecording = true;
        recordBtn.innerHTML = '<i class="fas fa-stop mr-2"></i>Stop Recording';
        recordBtn.classList.replace('bg-red-500', 'bg-gray-500');
    } else {
        stopRecording();
    }
}

function stopRecording() {
    if (isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        recordBtn.innerHTML = '<i class="fas fa-record-vinyl mr-2"></i>Record';
        recordBtn.classList.replace('bg-gray-500', 'bg-red-500');
    }
}

function downloadRecording() {
    if (recordedChunks.length === 0) {
        showError('No recording available to download');
        return;
    }

    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = 'fire-detection-recording.webm';
    a.click();
    URL.revokeObjectURL(url);
}

// UI Controls
startBtn.addEventListener('click', startDetection);

pauseBtn.addEventListener('click', () => {
    isPaused = true;
    isDetecting = false;
    startBtn.disabled = false;
    pauseBtn.disabled = true;
});

recordBtn.addEventListener('click', () => {
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
});

downloadBtn.addEventListener('click', downloadRecording);

clearLogBtn.addEventListener('click', () => {
    detectionLog.innerHTML = '';
    totalFireDetections = 0;
    fireCount.textContent = '0';
});

// Settings Modal
settingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
});

closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
});

saveSettingsBtn.addEventListener('click', () => {
    // Save settings
    settings.sensitivity = document.getElementById('sensitivitySlider').value;
    settings.alertSound = document.getElementById('alertSoundToggle').checked;
    settings.detectionMode = document.getElementById('detectionMode').value;
    settingsModal.classList.add('hidden');
});

// Error Modal
function showError(message) {
    errorMessage.textContent = message;
    errorModal.classList.remove('hidden');
}

closeErrorBtn.addEventListener('click', () => {
    errorModal.classList.add('hidden');
});

closeErrorModalBtn.addEventListener('click', () => {
    errorModal.classList.add('hidden');
});

// Fullscreen functionality
fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        fullscreenBtn.innerHTML = '<i class="fas fa-compress text-lg"></i>';
    } else {
        document.exitFullscreen();
        fullscreenBtn.innerHTML = '<i class="fas fa-expand text-lg"></i>';
    }
});

// Initialize the application
init();