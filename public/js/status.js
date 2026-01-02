// DOM Elements
const statusOrderIdInput = document.getElementById('statusOrderId');
const lookupOrderBtn = document.getElementById('lookupOrderBtn');
const orderDetails = document.getElementById('orderDetails');
const credentialsModal = document.getElementById('credentialsModal');
const copyAllBtn = document.getElementById('copyAllBtn');

// State
let currentOrder = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Extract order ID from URL if present
    const pathParts = window.location.pathname.split('/');
    const orderIdFromUrl = pathParts[pathParts.length - 1];
    
    if (orderIdFromUrl && orderIdFromUrl !== 'status') {
        statusOrderIdInput.value = orderIdFromUrl;
        checkOrderStatus();
    }
    
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Lookup order
    lookupOrderBtn.addEventListener('click', checkOrderStatus);
    
    // Enter key to check status
    statusOrderIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            checkOrderStatus();
        }
    });
    
    // Copy all credentials
    copyAllBtn?.addEventListener('click', copyAllCredentials);
    
    // Close modal
    document.querySelector('.close-modal')?.addEventListener('click', () => {
        credentialsModal.style.display = 'none';
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === credentialsModal) {
            credentialsModal.style.display = 'none';
        }
    });
    
    // Copy buttons in modal
    document.addEventListener('click', (e) => {
        if (e.target.closest('.copy-btn')) {
            const targetId = e.target.closest('.copy-btn').dataset.target;
            const value = document.getElementById(targetId)?.textContent;
            if (value) {
                copyToClipboard(value.trim());
                showToast('Copied to clipboard');
            }
        }
    });
}

// Check order status
async function checkOrderStatus() {
    const orderId = statusOrderIdInput.value.trim();
    
    if (!orderId) {
        showError('Please enter an Order ID');
        return;
    }
    
    try {
        showLoadingInOrderDetails('Loading order details...');
        
        const response = await fetch(`/api/check-order/${orderId}`);
        const data = await response.json();
        
        if (data.success) {
            currentOrder = data.order;
            displayOrderDetails(currentOrder);
            
            // Update URL without reloading
            window.history.pushState({}, '', `/status/${orderId}`);
        } else {
            showErrorInOrderDetails(data.error || 'Order not found');
        }
    } catch (error) {
        console.error('Check order error:', error);
        showErrorInOrderDetails('Network error. Please try again.');
    }
}

// Display order details
function displayOrderDetails(order) {
    let statusClass = '';
    let statusIcon = '';
    let statusMessage = '';
    
    switch (order.status) {
        case 'pending':
            statusClass = 'pending';
            statusIcon = 'fa-clock';
            statusMessage = 'Waiting for QRIS payment';
            break;
        case 'processing':
            statusClass = 'processing';
            statusIcon = 'fa-sync-alt fa-spin';
            statusMessage = 'Payment confirmed, provisioning server';
            break;
        case 'success':
            statusClass = 'success';
            statusIcon = 'fa-check-circle';
            statusMessage = 'Server active and ready to use';
            break;
        case 'failed':
            statusClass = 'failed';
            statusIcon = 'fa-times-circle';
            statusMessage = 'Payment failed or expired';
            break;
    }
    
    // Build server info HTML
    let serverInfoHTML = '';
    if (order.server_info) {
        serverInfoHTML = `
            <div class="server-info">
                <h4><i class="fas fa-server"></i> Server Information</h4>
                <div class="details-grid">
                    <div class="detail-row">
                        <span>Server ID:</span>
                        <strong>${order.server_info.identifier}</strong>
                    </div>
                    <div class="detail-row">
                        <span>Server Name:</span>
                        <strong>${order.server_info.name}</strong>
                    </div>
                    <div class="detail-row">
                        <span>Package:</span>
                        <strong>${order.server_info.package}</strong>
                    </div>
                    <div class="detail-row">
                        <span>Specifications:</span>
                        <strong>${order.server_info.memory}MB RAM • ${order.server_info.disk}MB Disk • ${order.server_info.cpu}% CPU</strong>
                    </div>
                    <div class="detail-row">
                        <span>Created:</span>
                        <strong>${new Date(order.server_info.created_at).toLocaleString()}</strong>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Build credentials HTML
    let credentialsHTML = '';
    let credentialsButton = '';
    
    if (order.status === 'success' && order.server_info?.credentials) {
        credentialsHTML = `
            <div class="server-credentials">
                <div class="credentials-header">
                    <h4><i class="fas fa-key"></i> Server Credentials</h4>
                    <button class="btn-outline" id="showCredentialsBtn">
                        <i class="fas fa-eye"></i> View Credentials
                    </button>
                </div>
                <div class="credentials-note">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Click "View Credentials" to access your server login details</p>
                </div>
            </div>
        `;
        
        credentialsButton = `
            <button class="btn-primary" id="viewCredentialsBtn">
                <i class="fas fa-key"></i> View Server Credentials
            </button>
        `;
    }
    
    // Build panel access HTML
    let panelAccessHTML = '';
    if (order.status === 'success' && order.server_info?.panel_url) {
        panelAccessHTML = `
            <div class="panel-access">
                <h4><i class="fas fa-external-link-alt"></i> Panel Access</h4>
                <div class="panel-link">
                    <a href="${order.server_info.panel_url}" target="_blank" class="btn-secondary">
                        <i class="fas fa-external-link-alt"></i> Open Pterodactyl Panel
                    </a>
                    <p class="text-muted">Use the credentials above to log into the panel</p>
                </div>
            </div>
        `;
    }
    
    // Build action buttons based on status
    let actionButtons = '';
    if (order.status === 'pending') {
        actionButtons = `
            <div class="action-buttons">
                <a href="/payment/${order.reff_id}" class="btn-primary">
                    <i class="fas fa-qrcode"></i> Complete Payment
                </a>
                <button class="btn-secondary" onclick="copyToClipboard('${order.reff_id}')">
                    <i class="fas fa-copy"></i> Copy Order ID
                </button>
            </div>
        `;
    } else if (order.status === 'success') {
        actionButtons = `
            <div class="action-buttons">
                ${credentialsButton}
                <a href="/" class="btn-outline">
                    <i class="fas fa-plus"></i> Order New Server
                </a>
            </div>
        `;
    } else if (order.status === 'failed') {
        actionButtons = `
            <div class="action-buttons">
                <a href="/" class="btn-primary">
                    <i class="fas fa-shopping-cart"></i> Create New Order
                </a>
            </div>
        `;
    }
    
    const orderHTML = `
        <div class="order-status-display">
            <div class="status-header-large">
                <div>
                    <h3>Order: ${order.reff_id}</h3>
                    <p class="text-muted">
                        Created: ${new Date(order.created_at).toLocaleString()} • 
                        Last Updated: ${new Date(order.updated_at).toLocaleString()}
                    </p>
                </div>
                <div class="status-badge ${statusClass}">
                    <i class="fas ${statusIcon}"></i> ${order.status.toUpperCase()}
                </div>
            </div>
            
            <div class="status-message">
                <i class="fas ${statusIcon.replace('fa-spin', '')}"></i>
                <p>${statusMessage}</p>
            </div>
            
            <div class="order-info-grid">
                <div class="info-card">
                    <h4><i class="fas fa-user"></i> Account Details</h4>
                    <div class="details-grid">
                        <div class="detail-row">
                            <span>Username:</span>
                            <strong>${order.username}</strong>
                        </div>
                        <div class="detail-row">
                            <span>Email:</span>
                            <strong>${order.username}@gmail.com</strong>
                        </div>
                        <div class="detail-row">
                            <span>Package:</span>
                            <strong>${order.package_name || order.package}</strong>
                        </div>
                    </div>
                </div>
                
                <div class="info-card">
                    <h4><i class="fas fa-receipt"></i> Payment Details</h4>
                    <div class="details-grid">
                        <div class="detail-row">
                            <span>Amount:</span>
                            <strong>Rp ${order.nominal.toLocaleString()}</strong>
                        </div>
                        <div class="detail-row">
                            <span>Status:</span>
                            <strong class="${statusClass}">${order.status.toUpperCase()}</strong>
                        </div>
                        ${order.paid_at ? `
                        <div class="detail-row">
                            <span>Paid At:</span>
                            <strong>${new Date(order.paid_at).toLocaleString()}</strong>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            ${serverInfoHTML}
            ${credentialsHTML}
            ${panelAccessHTML}
            ${actionButtons}
        </div>
    `;
    
    orderDetails.innerHTML = orderHTML;
    
    // Add event listeners for dynamically created buttons
    setTimeout(() => {
        const showCredentialsBtn = document.getElementById('showCredentialsBtn');
        const viewCredentialsBtn = document.getElementById('viewCredentialsBtn');
        
        if (showCredentialsBtn) {
            showCredentialsBtn.addEventListener('click', showCredentialsModal);
        }
        
        if (viewCredentialsBtn) {
            viewCredentialsBtn.addEventListener('click', showCredentialsModal);
        }
    }, 100);
}

// Show credentials modal
function showCredentialsModal() {
    if (!currentOrder?.server_info?.credentials) return;
    
    const creds = currentOrder.server_info.credentials;
    
    document.getElementById('modalPanelUrl').textContent = 
        currentOrder.server_info.panel_url || 'Not available';
    document.getElementById('modalUsername').textContent = creds.username;
    document.getElementById('modalPassword').textContent = creds.password;
    document.getElementById('modalEmail').textContent = creds.email;
    
    credentialsModal.style.display = 'flex';
}

// Copy all credentials
function copyAllCredentials() {
    const creds = currentOrder?.server_info?.credentials;
    if (!creds) return;
    
    const text = `Pterodactyl Panel Credentials:
Panel URL: ${currentOrder.server_info.panel_url}
Username: ${creds.username}
Password: ${creds.password}
Email: ${creds.email}

Keep these credentials secure!`;
    
    copyToClipboard(text);
    showToast('All credentials copied to clipboard');
}

// Utility functions
function showLoadingInOrderDetails(message) {
    orderDetails.innerHTML = `
        <div class="text-center">
            <div class="loading-spinner"></div>
            <p>${message}</p>
        </div>
    `;
}

function showErrorInOrderDetails(message) {
    orderDetails.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-circle fa-3x"></i>
            <h3>Error</h3>
            <p>${message}</p>
            <button class="btn-secondary" onclick="window.location.href='/'">
                <i class="fas fa-home"></i> Return to Home
            </button>
        </div>
    `;
}

function showError(message) {
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
    }).catch(err => {
        console.error('Copy failed:', err);
    });
}

// Add CSS for status page
const statusCSS = `
    .order-info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1.5rem;
        margin: 2rem 0;
    }
    
    .info-card {
        background: rgba(30, 41, 59, 0.8);
        padding: 1.5rem;
        border-radius: var(--radius-sm);
        border: 1px solid var(--dark-border);
    }
    
    .info-card h4 {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 1rem;
        color: var(--primary);
    }
    
    .status-message {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 1rem;
        background: rgba(30, 41, 59, 0.8);
        border-radius: var(--radius-sm);
        margin: 1.5rem 0;
        border-left: 4px solid var(--primary);
    }
    
    .status-message.pending { border-left-color: var(--warning); }
    .status-message.processing { border-left-color: var(--primary); }
    .status-message.success { border-left-color: var(--secondary); }
    .status-message.failed { border-left-color: var(--danger); }
    
    .status-message i {
        font-size: 1.5rem;
    }
    
    .status-message.pending i { color: var(--warning); }
    .status-message.processing i { color: var(--primary); }
    .status-message.success i { color: var(--secondary); }
    .status-message.failed i { color: var(--danger); }
    
    .credentials-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }
    
    .credentials-note {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 1rem;
        background: rgba(245, 158, 11, 0.1);
        border: 1px solid rgba(245, 158, 11, 0.3);
        border-radius: var(--radius-sm);
    }
    
    .credentials-note i {
        color: var(--warning);
        font-size: 1.2rem;
    }
    
    .panel-access {
        margin: 2rem 0;
        padding: 1.5rem;
        background: rgba(30, 41, 59, 0.8);
        border-radius: var(--radius-sm);
        border: 1px solid var(--dark-border);
    }
    
    .panel-access h4 {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 1rem;
        color: var(--primary);
    }
    
    .panel-link {
        text-align: center;
        padding: 1.5rem;
        background: rgba(30, 41, 59, 0.5);
        border-radius: var(--radius-sm);
    }
    
    .error-state {
        text-align: center;
        padding: 4rem 2rem;
        color: var(--text-secondary);
    }
    
    .error-state i {
        color: var(--danger);
        margin-bottom: 1.5rem;
    }
    
    .error-state h3 {
        color: var(--danger);
        margin-bottom: 1rem;
    }
    
    .action-buttons {
        display: flex;
        gap: 1rem;
        margin-top: 2rem;
        flex-wrap: wrap;
    }
    
    @media (max-width: 768px) {
        .order-info-grid {
            grid-template-columns: 1fr;
        }
        
        .action-buttons {
            flex-direction: column;
        }
        
        .action-buttons button,
        .action-buttons a {
            width: 100%;
        }
    }
`;

const statusStyleSheet = document.createElement("style");
statusStyleSheet.textContent = statusCSS;
document.head.appendChild(statusStyleSheet);