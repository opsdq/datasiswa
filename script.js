/**
 * Script.js - Full Data Renderer Tanpa Sensor
 */
const GAS_API_URL = "PASTE_YOUR_GAS_WEB_APP_URL_HERE";

let rawSheetHeaders = [];
let rawSheetRows = [];

document.addEventListener("DOMContentLoaded", () => {
  loadStudentsData(false);
});

async function loadStudentsData(showToast = false) {
  if (showToast) {
    Swal.fire({ title: 'Memuat ulang data...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  }
  try {
    const response = await fetch(GAS_API_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'getAllData' })
    });
    const res = await response.json();
    if (res && res.success) {
      rawSheetHeaders = res.headers || [];
      rawSheetRows = res.rows || [];
      renderTable(rawSheetRows);
      if (showToast) Swal.close();
    } else {
      throw new Error(res.message || 'Gagal mengambil data.');
    }
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Koneksi Gagal', text: err.message });
  }
}

function renderTable(rows) {
  const headerRow = document.getElementById("tableHeaderRow");
  const tbody = document.getElementById("tableBody");

  // Render Header
  let headerHtml = '<th class="py-3 px-4">No</th>';
  rawSheetHeaders.forEach(h => {
    headerHtml += `<th class="py-3 px-4">${escapeHtml(h)}</th>`;
  });
  headerHtml += '<th class="py-3 px-4 text-center">Aksi / Berkas</th>';
  headerRow.innerHTML = headerHtml;

  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${rawSheetHeaders.length + 2}" class="py-8 text-center text-slate-400">Tidak ada data ditemukan.</td></tr>`;
    return;
  }

  // Render Body
  let bodyHtml = '';
  rows.forEach((row, index) => {
    bodyHtml += `<tr class="hover:bg-slate-50 transition border-b border-slate-100">`;
    bodyHtml += `<td class="py-3 px-4 font-medium text-slate-500">${index + 1}</td>`;
    
    let hasDriveLink = false;
    let driveLinksHtml = '';

    row.forEach((cellVal, cellIdx) => {
      let displayVal = cellVal !== null && cellVal !== undefined ? String(cellVal) : '';
      
      // Deteksi URL Google Drive untuk dijadikan tombol popup / link
      if (displayVal.startsWith('http://') || displayVal.startsWith('https://')) {
        hasDriveLink = true;
        driveLinksHtml += `<a href="${displayVal}" target="_blank" class="inline-block bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-2.5 py-1 rounded-lg text-xs font-semibold mr-1 mb-1"><i class="fa-solid fa-external-link-alt"></i> Buka Link ${cellIdx + 1}</a>`;
        displayVal = `<a href="${displayVal}" target="_blank" class="text-indigo-600 underline truncate max-w-[150px] block" title="${displayVal}">${displayVal}</a>`;
      } else {
        displayVal = `<span class="truncate max-w-[200px] block" title="${escapeHtml(displayVal)}">${escapeHtml(displayVal)}</span>`;
      }

      bodyHtml += `<td class="py-3 px-4 text-xs">${displayVal}</td>`;
    });

    bodyHtml += `<td class="py-3 px-4 text-center whitespace-nowrap">
      <button onclick="openRowDetail(${index})" class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-medium mr-1" title="Lihat Semua Kolom"><i class="fa-solid fa-eye"></i> Detail</button>
    `;
    bodyHtml += `</td>`;
    bodyHtml += `</tr>`;
  });

  tbody.innerHTML = bodyHtml;
}

function filterTable() {
  const query = document.getElementById("searchInput").value.toLowerCase();
  const filtered = rawSheetRows.filter(row => {
    return row.some(cell => String(cell).toLowerCase().includes(query));
  });
  renderTable(filtered);
}

function openRowDetail(rowIndex) {
  const row = rawSheetRows[rowIndex];
  const content = document.getElementById("detailModalContent");
  let html = '';

  rawSheetHeaders.forEach((header, idx) => {
    const val = row[idx] || '-';
    let valFormatted = val;
    if (String(val).startsWith('http://') || String(val).startsWith('https://')) {
      valFormatted = `<a href="${val}" target="_blank" class="text-indigo-600 font-bold underline flex items-center gap-1 mt-1"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${val}</a>`;
    }
    html += `
      <div class="border-b pb-2">
        <span class="text-xs text-slate-400 font-semibold block uppercase">${escapeHtml(header)}</span>
        <div class="text-slate-800 font-medium mt-0.5">${valFormatted}</div>
      </div>
    `;
  });

  content.innerHTML = html;
  document.getElementById("detailModal").classList.remove("hidden");
  document.getElementById("detailModal").classList.add("flex");
}

function closeDetailModal() {
  document.getElementById("detailModal").classList.add("hidden");
  document.getElementById("detailModal").classList.remove("flex");
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
