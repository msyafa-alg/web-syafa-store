// DOM Elements
const orderForm = document.getElementById('orderForm');
const packageGrid = document.getElementById('packageGrid');
const usernameInput = document.getElementById('username');
const emailPreview = document.getElementById('emailPreview');
const checkOrderModal = document.getElementById('checkOrderModal');
const checkOrderBtn = document.getElementById('checkOrderBtn');
const closeModal = document.querySelector('.close-modal');
const checkStatusBtn = document.getElementById('checkStatusBtn');
const orderIdInput = document.getElementById('orderIdInput');
const orderStatusResult = document.getElementById('orderStatusResult');
const loadingOverlay = document.getElementById('loadingOverlay');

// State
let selectedPackage = null;
const SERVER_PACKAGES = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadPackages();
    setupEventListeners();
    updateOrderSummary();
});

// Load packages from API
async function loadPackages() {
    try {
        showLoading();
        const response = await fetch('/api/create-order/packages');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            SERVER_PACKAGES.length = 0;
            SERVER_PACKAGES.push(...data.packages);
            renderPackages();
        } else {
            throw new Error(data.error || 'Failed to load packages');
        }
    } catch (error) {
        console.error('Failed to load packages:', error);
        showNotification('Failed to load packages. Please refresh the page.', 'error');
        
        // Fallback packages if API fails
        SERVER_PACKAGES.length = 0;
        SERVER_PACKAGES.push(
            { id: 'basic', name: 'Basic Bot Hosting', ram: '1GB', disk: '5GB', cpu: '50%', price: 25000 },
            { id: 'standard', name: 'Standard Bot Hosting', ram: '2GB', disk: '10GB', cpu: '100%', price: 50000 },
            { id: 'premium', name: 'Premium Bot Hosting', ram: '4GB', disk: '20GB', cpu: '150%', price: 100000 },
            { id: 'enterprise', name: 'Enterprise Bot Hosting', ram: '8GB', disk: '40GB', cpu: '200%', price: 200000 }
        );
        renderPackages();
    } finally {
        hideLoading();
    }
}

// Render packages to the grid
function renderPackages() {
    if (!packageGrid) return;
    
    packageGrid.innerHTML = '';
    
    SERVER_PACKAGES.forEach(pkg => {
        const packageItem = document.createElement('div');
        packageItem.className = 'package-item';
        if (selectedPackage?.id === pkg.id) {
            packageItem.classList.add('selected');
        }
        
        packageItem.innerHTML = `
            <div class="package-header">
                <div class="package-name">${pkg.name}</div>
                <div class="package-price">Rp ${pkg.price.toLocaleString()}</div>
            </div>
            <ul class="package-specs">
                <li><i class="fas fa-memory"></i> RAM: ${pkg.ram}</li>
                <li><i class="fas fa-hdd"></i> Disk: ${pkg.disk}</li>
                <li><i class="fas fa-microchip"></i> CPU: ${pkg.cpu}</li>
            </ul>
            <div class="package-footer">
                <small>Perfect for ${pkg.id === 'basic' ? 'small bots' : pkg.id === 'enterprise' ? 'large scale bots' : 'medium bots'}</small>
            </div>
        `;
        
        packageItem.addEventListener('click', () => {
            selectPackage(pkg);
        });
        
        packageGrid.appendChild(packageItem);
    });
}

// Select a package
function selectPackage(pkg) {
    selectedPackage = pkg;
    
    // Update UI
    document.querySelectorAll('.package-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    const selectedElement = Array.from(document.querySelectorAll('.package-item'))
        .find(item => item.querySelector('.package-name')?.textContent === pkg.name);
    
    if (selectedElement) {
        selectedElement.classList.add('selected');
    }
    
    updateOrderSummary();
}

// Update email preview based on username
if (usernameInput) {
    usernameInput.addEventListener('input', () => {
        const username = usernameInput.value.trim();
        if (username.length >= 3) {
            emailPreview.textContent = `${username}@gmail.com`;
        } else {
            emailPreview.textContent = 'username@gmail.com';
        }
    });
}

// Update order summary
function updateOrderSummary() {
    const summaryPackage = document.getElementById('summaryPackage');
    const summaryRam = document.getElementById('summaryRam');
    const summaryDisk = document.getElementById('summaryDisk');
    const summaryCpu = document.getElementById('summaryCpu');
    const summaryPrice = document.getElementById('summaryPrice');
    
    if (summaryPackage) {
        summaryPackage.textContent = selectedPackage ? selectedPackage.name : '-';
    }
    if (summaryRam) {
        summaryRam.textContent = selectedPackage ? selectedPackage.ram : '-';
    }
    if (summaryDisk) {
        summaryDisk.textContent = selectedPackage ? selectedPackage.disk : '-';
    }
    if (summaryCpu) {
        summaryCpu.textContent = selectedPackage ? selectedPackage.cpu : '-';
    }
    if (summaryPrice) {
        summaryPrice.textContent = selectedPackage ? `Rp ${selectedPackage.price.toLocaleString()}` : 'Rp 0';
    }
}

// Form submission
if (orderForm) {
    orderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!selectedPackage) {
            showNotification('Please select a server package', 'error');
            return;
        }
        
        const username = usernameInput.value.trim();
        if (username.length < 3) {
            showNotification('Username must be at least 3 characters', 'error');
            return;
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            showNotification('Username can only contain letters, numbers, and underscores', 'error');
            return;
        }
        
        try {
            showLoading();
            
            const response = await fetch('/api/create-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    package: selectedPackage.id,
                    username: username
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification('Order created successfully! Redirecting to payment...', 'success');
                
                // Small delay for user to see the message
                setTimeout(() => {
                    window.location.href = `/payment/${data.order_id}`;
                }, 1000);
            } else {
                showNotification(data.error || 'Failed to create order', 'error');
            }
        } catch (error) {
            console.error('Order creation error:', error);
            showNotification('Network error. Please check your connection and try again.', 'error');
        } finally {
            hideLoading();
        }
    });
}

// Modal functionality
function setupEventListeners() {
    // Open check order modal
    if (checkOrderBtn) {
        checkOrderBtn.addEventListener('click', () => {
            if (checkOrderModal) {
                checkOrderModal.style.display = 'flex';
                if (orderIdInput) orderIdInput.focus();
            }
        });
    }
    
    // Close modal
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            if (checkOrderModal) {
                checkOrderModal.style.display = 'none';
            }
        });
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (checkOrderModal && e.target === checkOrderModal) {
            checkOrderModal.style.display = 'none';
        }
    });
    
    // Check order status
    if (checkStatusBtn) {
        checkStatusBtn.addEventListener('click', async () => {
            if (!orderIdInput) return;
            
            const orderId = orderIdInput.value.trim();
            
            if (!orderId) {
                showNotification('Please enter an Order ID', 'error');
                return;
            }
            
            try {
                showLoadingInResult('Checking order status...');
                
                const response = await fetch(`/api/check-order/${orderId}`);
                const data = await response.json();
                
                if (data.success) {
                    displayOrderStatus(data.order);
                } else {
                    showErrorInResult(data.error || 'Order not found');
                }
            } catch (error) {
                console.error('Check order error:', error);
                showErrorInResult('Network error. Please try again.');
            }
        });
    }
}

// Display order status in modal
function displayOrderStatus(order) {
    if (!orderStatusResult) return;
    
    let statusClass = '';
    let statusIcon = '';
    
    switch (order.status) {
        case 'pending':
            statusClass = 'pending';
            statusIcon = 'fa-clock';
            break;
        case 'processing':
            statusClass = 'processing';
            statusIcon = 'fa-sync-alt';
            break;
        case 'success':
            statusClass = 'success';
            statusIcon = 'fa-check-circle';
            break;
        case 'failed':
            statusClass = 'failed';
            statusIcon = 'fa-times-circle';
            break;
    }
    
    const serverInfo = order.server_info ? `
        <div class="server-info">
            <h4><i class="fas fa-server"></i> Server Information</h4>
            <div class="details-grid">
                <div class="detail-row">
                    <span>Server ID:</span>
                    <strong>${order.server_info.identifier || 'N/A'}</strong>
                </div>
                <div class="detail-row">
                    <span>Package:</span>
                    <strong>${order.server_info.package || order.package_name}</strong>
                </div>
                <div class="detail-row">
                    <span>RAM:</span>
                    <strong>${order.server_info.memory ? order.server_info.memory + 'MB' : 'N/A'}</strong>
                </div>
                ${order.server_info.panel_url ? `
                <div class="detail-row">
                    <span>Panel URL:</span>
                    <strong><a href="${order.server_info.panel_url}" target="_blank">Access Panel</a></strong>
                </div>
                ` : ''}
            </div>
        </div>
    ` : '';
    
    const credentials = order.credentials ? `
        <div class="credentials-warning">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Credentials are available on the status page</p>
        </div>
    ` : '';
    
    orderStatusResult.innerHTML = `
        <div class="order-status-display">
            <div class="status-header-large">
                <div>
                    <h3>Order: ${order.reff_id}</h3>
                    <p class="text-muted">Created: ${new Date(order.created_at).toLocaleString()}</p>
                </div>
                <div class="status-badge ${statusClass}">
                    <i class="fas ${statusIcon}"></i> ${order.status.toUpperCase()}
                </div>
            </div>
            
            <div class="details-grid">
                <div class="detail-row">
                    <span>Username:</span>
                    <strong>${order.username}</strong>
                </div>
                <div class="detail-row">
                    <span>Package:</span>
                    <strong>${order.package_name || order.package}</strong>
                </div>
                <div class="detail-row">
                    <span>Amount:</span>
                    <strong>Rp ${order.nominal ? order.nominal.toLocaleString() : '0'}</strong>
                </div>
                <div class="detail-row">
                    <span>Last Updated:</span>
                    <strong>${new Date(order.updated_at || order.created_at).toLocaleString()}</strong>
                </div>
            </div>
            
            ${serverInfo}
            ${credentials}
            
            <div class="server-actions">
                <a href="/status/${order.reff_id}" class="btn-primary">
                    <i class="fas fa-external-link-alt"></i> View Full Details
                </a>
                <button class="btn-secondary" onclick="copyToClipboard('${order.reff_id}')">
                    <i class="fas fa-copy"></i> Copy Order ID
                </button>
            </div>
        </div>
    `;
}

// Utility functions
function showLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.add('active');
    }
}

function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
    }
}

function showNotification(message, type = 'info') {
    // Remove any existing notification
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Add CSS if not exists
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                background: var(--dark-card);
                border: 1px solid var(--dark-border);
                box-shadow: var(--shadow);
                display: flex;
                align-items: center;
                gap: 10px;
                z-index: 99999;
                transform: translateX(150%);
                transition: transform 0.3s ease;
                max-width: 400px;
            }
            
            .notification.show {
                transform: translateX(0);
            }
            
            .notification.error {
                border-left: 4px solid var(--danger);
            }
            
            .notification.success {
                border-left: 4px solid var(--secondary);
            }
            
            .notification.info {
                border-left: 4px solid var(--primary);
            }
            
            .notification i {
                font-size: 1.2rem;
            }
            
            .notification.error i {
                color: var(--danger);
            }
            
            .notification.success i {
                color: var(--secondary);
            }
            
            .notification.info i {
                color: var(--primary);
            }
        `;
        document.head.appendChild(style);
    }
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

function showLoadingInResult(message) {
    if (!orderStatusResult) return;
    
    orderStatusResult.innerHTML = `
        <div class="text-center">
            <div class="spinner"></div>
            <p>${message}</p>
        </div>
    `;
}

function showErrorInResult(message) {
    if (!orderStatusResult) return;
    
    orderStatusResult.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-circle"></i>
            <p>${message}</p>
        </div>
    `;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Copy failed:', err);
        showNotification('Failed to copy', 'error');
    });
}

// Export for use in other files
if (typeof module === 'object') {
    module.exports = { copyToClipboard };
}