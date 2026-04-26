// 1. Initialize Supabase
const SUPABASE_URL = 'https://tlbtshyghyuwvjiyohto.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsYnRzaHlnaHl1d3ZqaXlvaHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMjQ4MTQsImV4cCI6MjA5MjcwMDgxNH0.YKEZ99QI1bAqGOQ8fdirSaJpgSxFNt8LPZezbXxFy6A';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State Variables
let currentUser = null;
let currentRole = null;
let activeDocumentId = null; 
let currentUserName = null; 

// Email Mappings
const BP_EMAILS = {
    'Nilmini': 'dhammikapra@gmail.com',
    'Peshalika': 'devinhansaja100@gmail.com'
};

// 2. Authentication Logic
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // Fetch User Role
        const { data: profileData, error: profileError } = await supabaseClient
            .from('user_profiles')
            .select('role, name')
            .eq('id', data.user.id)
            .single();
            
        if (profileError) throw profileError;

        currentUser = data.user;
        currentRole = profileData.role;
        document.getElementById('user-role-display').innerText = `${profileData.name} | ${currentRole}`;
        
        setupDashboard();
    } catch (error) {
        errorDiv.innerText = error.message;
        errorDiv.classList.remove('hidden');
    }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.reload();
});

// 3. Navigation & Dashboard Setup
function setupDashboard() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
    
    // Save the user's name so we can filter BP documents correctly
    currentUserName = document.getElementById('user-role-display').innerText.split(' | ')[0];
    
    const navMenu = document.getElementById('nav-menu');
    navMenu.innerHTML = '';

    if (currentRole === 'HR Executive') {
        addNavButton('Upload Document', 'hr-upload-view', true);
        addNavButton('Document Verification', 'hr-verify-view');
        addNavButton('Track Document', 'hr-track-view'); 
        addNavButton('Settle Document', 'hr-settle-view');
        showView('hr-upload-view');
        loadNextDocumentID();
    } else if (currentRole === 'BP User') {
        addNavButton('Review Documents', 'bp-pending-view', true);
        addNavButton('ANDON Documents', 'bp-andon-view');
        addNavButton('Approved Documents', 'bp-approved-view');
        showView('bp-pending-view');
        loadBPTable('Pending BP Review', 'bp-pending-tbody'); 
    }
}

function addNavButton(text, targetViewId, isActive = false) {
    const btn = document.createElement('button');
    btn.className = `nav-btn ${isActive ? 'active' : ''}`;
    btn.innerText = text;
    btn.onclick = (e) => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        showView(targetViewId);
        
        // Load specific data when clicking tabs
        if(targetViewId === 'hr-settle-view') loadSettledDocuments();
        if(targetViewId === 'hr-verify-view') loadPendingVerifications(); 
        if(targetViewId === 'bp-pending-view') loadBPTable('Pending BP Review', 'bp-pending-tbody');
        if(targetViewId === 'bp-andon-view') loadBPTable('Andon', 'bp-andon-tbody');
        if(targetViewId === 'bp-approved-view') loadBPTable('Pending Verification', 'bp-approved-tbody', true);
    };
    document.getElementById('nav-menu').appendChild(btn);
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
}

// 4. HR: Upload Document (Interface 01)
async function loadNextDocumentID() {
    const { data, error } = await supabaseClient
        .from('employee_documents')
        .select('id')
        .order('id', { ascending: false })
        .limit(1);
    
    const nextId = (data && data.length > 0) ? data[0].id + 1 : 1;
    document.getElementById('sys-id').value = nextId.toString().padStart(2, '0');
}

document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        epf_number: document.getElementById('epf-num').value,
        employee_name: document.getElementById('emp-name').value,
        contact_number: document.getElementById('contact-num').value,
        department: document.getElementById('department').value,
        relationship: document.getElementById('relationship').value,
        relationship_name: document.getElementById('rel-name').value,
        bp_name: document.getElementById('bp-name').value,
        status: 'Pending BP Review'
    };

    const msgDiv = document.getElementById('upload-msg');
    
    const { error } = await supabaseClient.from('employee_documents').insert([payload]);
    
    if (error) {
        msgDiv.className = 'alert error';
        msgDiv.innerText = `Error: ${error.message}`;
    } else {
        msgDiv.className = 'alert success';
        msgDiv.innerText = 'Document successfully uploaded!';
        document.getElementById('upload-form').reset();
        loadNextDocumentID();
        setTimeout(() => msgDiv.classList.add('hidden'), 3000);
    }
    msgDiv.classList.remove('hidden');
});

// 5. BP: Dashboard Tables & Review Logic
async function loadBPTable(statusType, tbodyId, isApprovedTab = false) {
    const { data, error } = await supabaseClient
        .from('employee_documents')
        .select('*')
        .eq('bp_name', currentUserName)
        .eq('status', statusType)
        .order('created_at', { ascending: false });

    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = '';

    if (data) {
        data.forEach(doc => {
            const tr = document.createElement('tr');
            if (isApprovedTab) {
                tr.innerHTML = `
                    <td>${doc.epf_number}</td>
                    <td>${doc.employee_name}</td>
                    <td><span class="badge" style="background:var(--primary-blue)">${doc.status}</span></td>
                    <td>${new Date(doc.created_at).toLocaleDateString()}</td>
                `;
            } else {
                tr.innerHTML = `
                    <td>${doc.epf_number}</td>
                    <td>${doc.employee_name}</td>
                    <td>${new Date(doc.created_at).toLocaleDateString()}</td>
                    <td><button class="btn btn-primary" onclick='openBPActionModal(${JSON.stringify(doc)})'>Review</button></td>
                `;
            }
            tbody.appendChild(tr);
        });
    }
}

// Open BP Action Modal
window.openBPActionModal = function(doc) {
    activeDocumentId = doc.id;
    renderDataGrid('bp-action-data', doc);
    document.getElementById('bp-action-modal').classList.remove('hidden');
};

document.getElementById('close-bp-modal').addEventListener('click', () => {
    document.getElementById('bp-action-modal').classList.add('hidden');
});

// Submit BP Review from Modal
document.getElementById('bp-action-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const reviewData = {
        document_id: activeDocumentId,
        relationship_type: document.getElementById('bp-rel-type').value,
        additional_details: document.getElementById('bp-details-text').value
    };

    // Save review & update status back to HR
    await supabaseClient.from('bp_reviews').insert([reviewData]);
    await supabaseClient.from('employee_documents').update({ status: 'Pending Verification' }).eq('id', activeDocumentId);
    
    alert('Document successfully sent to HR for verification.');
    document.getElementById('bp-action-form').reset();
    document.getElementById('bp-action-modal').classList.add('hidden');
    
    // Reload the current table they were looking at
    if(!document.getElementById('bp-pending-view').classList.contains('hidden')) {
        loadBPTable('Pending BP Review', 'bp-pending-tbody');
    } else {
        loadBPTable('Andon', 'bp-andon-tbody');
    }
});

// 6. HR: Verification & ANDON
async function loadPendingVerifications() {
    const { data, error } = await supabaseClient
        .from('employee_documents')
        .select('*')
        .eq('status', 'Pending Verification')
        .order('created_at', { ascending: false });

    const tbody = document.getElementById('verify-pending-tbody');
    tbody.innerHTML = '';

    if (data && data.length > 0) {
        data.forEach(doc => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${doc.epf_number}</td>
                <td>${doc.employee_name}</td>
                <td>${doc.bp_name}</td>
                <td>${new Date(doc.created_at).toLocaleDateString()}</td>
                <td><button class="btn btn-primary" onclick='openVerifyDetails(${JSON.stringify(doc)})'>Review</button></td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No documents waiting for verification.</td></tr>';
    }
}

window.openVerifyDetails = function(doc) {
    activeDocumentId = doc.id;
    renderDataGrid('verify-data-container', doc);
    
    document.getElementById('verify-table-container').classList.add('hidden');
    document.getElementById('verify-details').classList.remove('hidden');
    
    document.getElementById('andon-epf').value = doc.epf_number;
    document.getElementById('andon-name').value = doc.employee_name;
    document.getElementById('andon-msg').dataset.bpName = doc.bp_name; 
};

document.getElementById('btn-search-verify').addEventListener('click', async () => {
    const epf = document.getElementById('search-verify-epf').value;
    if(!epf) return alert('Please enter an EPF Number');

    const { data, error } = await supabaseClient
        .from('employee_documents')
        .select('*')
        .eq('epf_number', epf)
        .eq('status', 'Pending Verification')
        .single();
    
    if (data) {
        openVerifyDetails(data);
    } else {
        alert('No document awaiting verification found for this EPF.');
    }
});

document.getElementById('btn-cancel-verify').addEventListener('click', () => {
    resetVerifyView();
});

document.getElementById('btn-insurance').addEventListener('click', async () => {
    await supabaseClient.from('employee_documents').update({ status: 'Settled' }).eq('id', activeDocumentId);
    await supabaseClient.from('insurance_settlements').insert([{ document_id: activeDocumentId }]);
    
    alert('Document successfully Settled & sent to Insurance.');
    resetVerifyView();
});

document.getElementById('btn-andon').addEventListener('click', () => {
    document.getElementById('andon-modal').classList.remove('hidden');
});

document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('andon-modal').classList.add('hidden');
});

document.getElementById('andon-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const epf = document.getElementById('andon-epf').value;
    const name = document.getElementById('andon-name').value;
    const message = document.getElementById('andon-msg').value;
    const bpName = document.getElementById('andon-msg').dataset.bpName;
    const targetEmail = BP_EMAILS[bpName];

    await supabaseClient.from('employee_documents').update({ status: 'Andon' }).eq('id', activeDocumentId);
    await supabaseClient.from('andon_requests').insert([{ document_id: activeDocumentId, message: message, sent_to_email: targetEmail }]);
    await supabaseClient.from('bp_reviews').delete().eq('document_id', activeDocumentId);

    emailjs.init("Gnxwym0JzqrMP-De7"); 
    
    const templateParams = { 
        to_email: targetEmail, 
        employee_name: name, 
        epf_number: epf, 
        message: message, 
        hr_email: 'kanishkanirmal91@gmail.com' 
    };

    try {
        await emailjs.send('service_w03atce', 'template_y9liq2w', templateParams);
        alert('ANDON Raised and Email Sent Successfully to ' + bpName);
    } catch (err) {
        alert('Data saved but email failed to send. Check EmailJS config.');
    }

    document.getElementById('andon-form').reset();
    document.getElementById('andon-modal').classList.add('hidden');
    resetVerifyView();
});

function resetVerifyView() {
    document.getElementById('verify-details').classList.add('hidden');
    document.getElementById('verify-table-container').classList.remove('hidden');
    document.getElementById('search-verify-epf').value = '';
    activeDocumentId = null;
    loadPendingVerifications(); 
}

// 7. HR: Track Document
document.getElementById('btn-track-epf').addEventListener('click', async () => {
    const epf = document.getElementById('search-track-epf').value;
    const resultDiv = document.getElementById('track-result');
    
    const { data, error } = await supabaseClient
        .from('employee_documents')
        .select('status, bp_name, epf_number')
        .eq('epf_number', epf)
        .single();
    
    resultDiv.classList.remove('hidden');
    
    if (data) {
        resultDiv.className = 'alert success mt-2';
        resultDiv.innerText = `Status: EPF ${data.epf_number} is currently in "${data.status}" at ${data.bp_name}.`;
    } else {
        resultDiv.className = 'alert error mt-2';
        resultDiv.innerText = `No document found for EPF ${epf}.`;
    }
});

// 8. HR: Settle Document (Interface 03)
async function loadSettledDocuments() {
    const { data, error } = await supabaseClient
        .from('employee_documents')
        .select('*')
        .eq('status', 'Settled')
        .order('created_at', { ascending: false });

    const tbody = document.getElementById('settle-tbody');
    tbody.innerHTML = '';

    if (data) {
        data.forEach(doc => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${doc.epf_number}</td>
                <td>${doc.employee_name}</td>
                <td>${doc.bp_name}</td>
                <td>${doc.relationship}</td>
                <td><span class="badge insurance">${doc.status}</span></td>
                <td>${new Date(doc.created_at).toLocaleDateString()}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// Helper: Render Data Grid dynamically
function renderDataGrid(containerId, data) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div class="data-item"><span>EPF Number</span><strong>${data.epf_number}</strong></div>
        <div class="data-item"><span>Name</span><strong>${data.employee_name}</strong></div>
        <div class="data-item"><span>Department</span><strong>${data.department}</strong></div>
        <div class="data-item"><span>Contact</span><strong>${data.contact_number}</strong></div>
        <div class="data-item"><span>Relationship</span><strong>${data.relationship} (${data.relationship_name})</strong></div>
        <div class="data-item"><span>Assigned BP</span><strong>${data.bp_name}</strong></div>
    `;
}

// ==========================================
// FEATURE: Reset System ID Sequence
// ==========================================
document.getElementById('btn-reset-id').addEventListener('click', async () => {
    const confirmReset = confirm("⚠️ WARNING: This will DELETE ALL current documents and reset the System ID back to 01. Are you absolutely sure?");
    
    if (confirmReset) {
        const { error } = await supabaseClient.rpc('reset_system_sequence');
        
        if (error) {
            alert("Error resetting database. Make sure you ran the SQL function in Supabase. Error: " + error.message);
        } else {
            alert("System successfully reset! ID is starting fresh at 01.");
            loadNextDocumentID(); 
        }
    }
});

// ==========================================
// FEATURE: Download ANDON Report (HR History with Reasons)
// ==========================================
document.getElementById('btn-download-andon').addEventListener('click', async () => {
    // Fetch from andon_requests to get permanent history AND reasons, joining the document details
    const { data, error } = await supabaseClient
        .from('andon_requests')
        .select(`
            message,
            created_at,
            employee_documents (
                id,
                epf_number,
                employee_name,
                department,
                contact_number,
                bp_name,
                relationship,
                relationship_name
            )
        `)
        .order('created_at', { ascending: false });

    if (error) return alert("Error fetching report data: " + error.message);
    if (!data || data.length === 0) return alert("There are no ANDON records to download.");

    // Set up CSV Headers (Now includes 'ANDON Reason')
    const headers = ['Document ID', 'EPF Number', 'Employee Name', 'Department', 'Contact', 'BP Name', 'Relationship', 'ANDON Reason', 'Date Raised'];
    const csvRows = [headers.join(',')];

    // Loop through data and format as CSV rows
    data.forEach(row => {
        const doc = row.employee_documents;
        
        // Ensure the document still exists before adding to row
        if (doc) {
            // Escape any double quotes inside the message so it doesn't break the CSV format
            const cleanMessage = row.message ? row.message.replace(/"/g, '""') : "No reason provided";

            const csvRow = [
                doc.id,
                `"${doc.epf_number}"`,
                `"${doc.employee_name}"`,
                `"${doc.department}"`,
                `"${doc.contact_number}"`,
                `"${doc.bp_name}"`,
                `"${doc.relationship} (${doc.relationship_name})"`,
                `"${cleanMessage}"`, 
                `"${new Date(row.created_at).toLocaleDateString()}"`
            ];
            csvRows.push(csvRow.join(','));
        }
    });

    // Trigger the download automatically
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `Historical_ANDON_Report_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});