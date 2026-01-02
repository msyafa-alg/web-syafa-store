// DOM Elements
const timerElement = document.getElementById('timerText');
const qrisImage = document.getElementById('qrisImage');
const orderIdDisplay = document.getElementById('orderIdDisplay');
const amountDisplay = document.getElementById('amountDisplay');
const expiryDisplay = document.getElementById('expiryDisplay');
const usernameDetail = document.getElementById('usernameDetail');
const emailDetail = document.getElementById('emailDetail');
const packageDetail = document.getElementById('packageDetail');
const specsDetail = document.getElementById('specsDetail');
const orderTimeDetail = document.getElementById('orderTimeDetail');
const copyOrderIdBtn = document.getElementById('copyOrderIdBtn');
const checkStatusBtn = document.getElementById('checkStatusBtn');
const statusUpdates = document.getElementById('statusUpdates');
const statusModal = document.getElementById('statusModal');
const viewStatusLink = document.getElementById('viewStatusLink');
const loadingOverlay = document.getElementById('loadingOverlay');

// State
let orderId = null;
let orderData = null;
let paymentTimer = null;
let checkInterval = null;
let timeLeft = 15 * 60; // 15 minutes in seconds

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Extract order ID from URL
    const pathParts = window.location.pathname.split('/');
    orderId = pathParts[pathParts.length - 1];
    
    if (!orderId || orderId === 'payment') {
        redirectToHome('Invalid order ID');
        return;
    }
    
    await loadOrderData();
    setupEventListeners();
    startPaymentTimer();
    startStatusPolling();
});

// Load order data
async function loadOrderData() {
    try {
        showLoading();
        
        const response = await fetch(`/api/check-order/${orderId}`);
        const data = await response.json();
        
        if (data.success) {
            orderData = data.order;
            renderOrderData();
            
            // If payment already successful, redirect to status
            if (orderData.status === 'success') {
                redirectToStatus();
                return;
            }
            
            // If order is failed, show message
            if (orderData.status === 'failed') {
                showError('Payment failed or expired. Please create a new order.');
                return;
            }
        } else {
            redirectToHome('Order not found');
        }
    } catch (error) {
        console.error('Load order error:', error);
        showError('Failed to load order data');
    } finally {
        hideLoading();
    }
}

// Render order data to the page
function renderOrderData() {
    if (!orderData) return;
    
    // Update displays
    orderIdDisplay.textContent = orderData.reff_id;
    amountDisplay.textContent = `Rp ${orderData.nominal.toLocaleString()}`;
    
    if (orderData.expired_at) {
        const expiryDate = new Date(orderData.expired_at);
        expiryDisplay.textContent = expiryDate.toLocaleString();
    }
    
    usernameDetail.textContent = orderData.username;
    emailDetail.textContent = `${orderData.username}@gmail.com`;
    packageDetail.textContent = orderData.package_name || 'Loading...';
    
    if (orderData.package_details) {
        specsDetail.textContent = 
            `${orderData.package_details.ram} / ${orderData.package_details.disk} / ${orderData.package_details.cpu}`;
    }
    
    orderTimeDetail.textContent = new Date(orderData.created_at).toLocaleString();
    
    // Load QR code if available
    if (orderData.qr_url) {
        loadQRCode(orderData.qr_url);
    }
}

// Load QR code image
function loadQRCode(qrUrl) {
    qrisImage.innerHTML = '';
    
    const img = document.createElement('img');
    img.src = qrUrl;
    img.alt = 'QRIS Payment Code';
    img.onload = () => {
        qrisImage.classList.add('loaded');
    };
    img.onerror = () => {
        qrisImage.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load QR code</p>
                <small>Please check your order status</small>
            </div>
        `;
    };
    
    qrisImage.appendChild(img);
}

// Start payment countdown timer
function startPaymentTimer() {
    if (paymentTimer) clearInterval(paymentTimer);
    
    paymentTimer = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(paymentTimer);
            timerElement.textContent = 'Expired';
            timerElement.parentElement.classList.add('expired');
            
            // Show expired message
            addStatusUpdate('Payment window expired', 'error');
            showError('Payment window has expired. Please create a new order.');
            return;
        }
        
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Change color when less than 5 minutes
        if (timeLeft < 300) {
            timerElement.parentElement.classList.add('warning');
        }
        
        timeLeft--;
    }, 1000);
}

// Start polling for status updates
function startStatusPolling() {
    if (checkInterval) clearInterval(checkInterval);
    
    checkInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/check-order/${orderId}`);
            const data = await response.json();
            
            if (data.success && data.order.status !== orderData.status) {
                // Status changed
                orderData = data.order;
                addStatusUpdate(`Status changed to: ${data.order.status}`, 'info');
                
                if (data.order.status === 'success') {
                    clearInterval(checkInterval);
                    showSuccessModal();
                } else if (data.order.status === 'failed') {
                    clearInterval(checkInterval);
                    showError('Payment failed. Please create a new order.');
                }
            }
        } catch (error) {
            console.error('Status poll error:', error);
        }
    }, 5000); // Check every 5 seconds
}

// Setup event listeners
function setupEventListeners() {
    // Copy Order ID button
    copyOrderIdBtn?.addEventListener('click', () => {
        copyToClipboard(orderId);
        showToast('Order ID copied to clipboard');
    });
    
    // Manual status check
    checkStatusBtn?.addEventListener('click', async () => {
        await checkOrderStatus();
    });
    
    // View status link in modal
    viewStatusLink?.addEventListener('click', (e) => {
        e.preventDefault();
        redirectToStatus();
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === statusModal) {
            statusModal.style.display = 'none';
        }
    });
}

// Check order status manually
async function checkOrderStatus() {
    try {
        const response = await fetch(`/api/check-order/${orderId}`);
        const data = await response.json();
        
        if (data.success) {
            orderData = data.order;
            addStatusUpdate('Manual status check completed', 'info');
            
            if (data.order.status === 'success') {
                showSuccessModal();
            }
        }
    } catch (error) {
        console.error('Manual check error:', error);
        addStatusUpdate('Failed to check status', 'error');
    }
}

// Add status update to the list
function addStatusUpdate(message, type = 'info') {
    const updateItem = document.createElement('div');
    updateItem.className = 'update-item';
    
    let icon = 'fa-info-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'success') icon = 'fa-check-circle';
    
    updateItem.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
        <small class="update-time">${new Date().toLocaleTimeString()}</small>
    `;
    
    statusUpdates.insertBefore(updateItem, statusUpdates.firstChild);
    
    // Limit to 5 updates
    if (statusUpdates.children.length > 5) {
        statusUpdates.removeChild(statusUpdates.lastChild);
    }
}

// Show success modal
function showSuccessModal() {
    statusModal.style.display = 'flex';
    viewStatusLink.href = `/status/${orderId}`;
    
    // Auto-redirect after 10 seconds
    setTimeout(() => {
        redirectToStatus();
    }, 10000);
}

// Utility functions
function redirectToHome(message = null) {
    if (message) {
        alert(message);
    }
    window.location.href = '/';
}

function redirectToStatus() {
    window.location.href = `/status/${orderId}`;
}

function showLoading() {
    loadingOverlay?.classList.add('active');
}

function hideLoading() {
    loadingOverlay?.classList.remove('active');
}

function showError(message) {
    // In production, use a better notification system
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-toast';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Success handled by showToast
    });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (paymentTimer) clearInterval(paymentTimer);
    if (checkInterval) clearInterval(checkInterval);
});

// Add CSS for toast notifications
const toastCSS = `
    .toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--secondary);
        color: white;
        padding: 12px 24px;
        border-radius: var(--radius-sm);
        box-shadow: var(--shadow);
        transform: translateY(100px);
        opacity: 0;
        transition: all 0.3s ease;
        z-index: 9999;
    }
    
    .toast.show {
        transform: translateY(0);
        opacity: 1;
    }
    
    .error-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--danger);
        color: white;
        padding: 12px 24px;
        border-radius: var(--radius-sm);
        box-shadow: var(--shadow);
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 9999;
    }
    
    .expired {
        background: rgba(239, 68, 68, 0.2) !important;
        color: var(--danger) !important;
        border-color: var(--danger) !important;
    }
    
    .warning {
        background: rgba(245, 158, 11, 0.2) !important;
        color: var(--warning) !important;
        border-color: var(--warning) !important;
    }
`;

const styleSheet = document.createElement("style");
styleSheet.textContent = toastCSS;
document.head.appendChild(styleSheet);