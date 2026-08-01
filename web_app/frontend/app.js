function openPortal(portalName) {
    if (portalName === 'patient') {
        window.location.href = '/static/patient.html';
    } else if (portalName === 'driver') {
        window.location.href = '/static/driver.html';
    } else if (portalName === 'admin') {
        window.location.href = '/static/admin.html';
    } else {
        alert(portalName.charAt(0).toUpperCase() + portalName.slice(1) + ' Portal is under development in Web Version.');
    }
}

// Check backend connectivity on load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/patient/status');
        const data = await res.json();
        console.log('Backend connected:', data);
    } catch (err) {
        console.warn('Backend not running or unreachable:', err);
    }
});
