import { db } from './firebase-config.js';
import { checkAuth, formatDate, downloadCSV, downloadPDF } from './dashboard.js';

let currentProjectId = null;
let projectsData = [];
const exportProjectsPdfBtn = document.getElementById('exportProjectsPdfBtn');
const exportProjectsCsvBtn = document.getElementById('exportProjectsCsvBtn');

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    loadProjects();
    checkPendingActions();
    
    window.addEventListener('sectionChanged', (e) => {
        if (e.detail === 'projects') {
            loadProjects();
            checkPendingActions();
        }
    });
    
    document.getElementById('addProjectBtn').addEventListener('click', () => {
        new bootstrap.Modal(document.getElementById('projectModal')).show();
    });
    
    document.getElementById('projectModal').addEventListener('hidden.bs.modal', resetProjectForm);

    document.getElementById('saveProjectBtn').addEventListener('click', saveProject);

    if (exportProjectsCsvBtn) {
        exportProjectsCsvBtn.addEventListener('click', exportProjectsCSV);
    }

    if (exportProjectsPdfBtn) {
        exportProjectsPdfBtn.addEventListener('click', exportProjectsPDF);
    }
});

async function loadProjects() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;
    const businessId = user.businessId || user.uid;
    const tbody = document.querySelector('#projectsTable tbody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';

    try {
        const snapshot = await db.collection('users').doc(businessId).collection('projects').orderBy('createdAt', 'desc').get();
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No projects found</td></tr>';
            return;
        }

        projectsData = [];
        snapshot.forEach(doc => {
            const p = doc.data();
            projectsData.push({ id: doc.id, ...p });
            const escape = (str) => (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n').replace(/\r/g, '');
            const canDelete = user.permissions ? user.permissions.canDelete : true;
            const row = `
                <tr>
                    <td>${p.name}</td>
                    <td>${p.customerName}</td>
                    <td><span class="badge bg-${getStatusColor(p.status)}">${p.status}</span></td>
                    <td>${formatDate(p.createdAt)}</td>
                    <td>₹${(p.value || 0).toLocaleString()}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="editProject('${doc.id}', '${escape(p.name)}', '${escape(p.customerName)}', '${escape(p.status)}', ${p.value})">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${canDelete ? `<button class="btn btn-sm btn-outline-danger" onclick="deleteProject('${doc.id}')">
                            <i class="fas fa-trash"></i>
                        </button>` : ''}
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading projects</td></tr>';
    }
}

function getProjectsExportRows() {
    return projectsData.map(p => ([
        p.name || '',
        p.customerName || '',
        p.status || '',
        formatDate(p.createdAt),
        p.value ?? 0
    ]));
}

function exportProjectsCSV() {
    if (!projectsData.length) {
        alert('No projects to export.');
        return;
    }

    const headers = ['Project Name', 'Customer', 'Status', 'Start Date', 'Value'];
    const rows = getProjectsExportRows();
    const filename = `projects_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(filename, headers, rows);
}

function exportProjectsPDF() {
    if (!projectsData.length) {
        alert('No projects to export.');
        return;
    }

    const headers = ['Project Name', 'Customer', 'Status', 'Start Date', 'Value'];
    const rows = getProjectsExportRows();
    const filename = `projects_${new Date().toISOString().split('T')[0]}.pdf`;
    downloadPDF(filename, 'Projects Report', headers, rows);
}

async function saveProject() {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    const name = document.getElementById('projectName').value;
    const customerName = document.getElementById('customerName').value;
    const status = document.getElementById('projectStatus').value;
    const value = parseFloat(document.getElementById('projectValue').value) || 0;

    if (!name || !customerName) return alert('Please fill required fields');

    try {
        const projectData = {
            name,
            customerName,
            status,
            value,
            updatedAt: new Date()
        };

        if (currentProjectId) {
            await db.collection('users').doc(businessId).collection('projects').doc(currentProjectId).update(projectData);
        } else {
            projectData.createdAt = new Date();
            await db.collection('users').doc(businessId).collection('projects').add(projectData);
        }
        
        bootstrap.Modal.getInstance(document.getElementById('projectModal')).hide();
        document.getElementById('projectForm').reset();
        loadProjects();
    } catch (e) {
        console.error(e);
        alert('Failed to save project');
    }
}

function getStatusColor(status) {
    if (status === 'Completed') return 'success';
    if (status === 'In Progress') return 'primary';
    return 'warning';
}

function resetProjectForm() {
    currentProjectId = null;
    document.getElementById('projectForm').reset();
    document.querySelector('#projectModal .modal-title').textContent = 'New Project';
}

window.editProject = (id, name, customer, status, value) => {
    currentProjectId = id;
    document.getElementById('projectName').value = name;
    document.getElementById('customerName').value = customer;
    document.getElementById('projectStatus').value = status;
    document.getElementById('projectValue').value = value || 0;
    document.querySelector('#projectModal .modal-title').textContent = 'Edit Project';
    new bootstrap.Modal(document.getElementById('projectModal')).show();
};

function checkPendingActions() {
    if (sessionStorage.getItem('openProjectModal')) {
        sessionStorage.removeItem('openProjectModal');
        
        // Check for selected customer
        const customerData = sessionStorage.getItem('selectedCustomer');
        if (customerData) {
            const customer = JSON.parse(customerData);
            document.getElementById('customerName').value = customer.name;
            sessionStorage.removeItem('selectedCustomer');
        }
        
        resetProjectForm();
        new bootstrap.Modal(document.getElementById('projectModal')).show();
    }
}

// Expose delete globally for the onclick handler
window.deleteProject = async (id) => {
    if(!confirm('Delete this project?')) return;
    const user = JSON.parse(localStorage.getItem('user'));
    if (user.permissions && user.permissions.canDelete === false) {
        return alert('You do not have permission to delete items.');
    }

    const businessId = user.businessId || user.uid;
    try {
        await db.collection('users').doc(businessId).collection('projects').doc(id).delete();
        loadProjects();
    } catch(e) {
        console.error(e);
    }
};
