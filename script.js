/**
 * Core Front-End Engine - SDQU An-Najaah
 */

let globalStudentsData = [];
let currentSessionToken = sessionStorage.getItem('sdqu_token') || null;
let isPrivacyMasked = true;
let tkChartInstance = null;
let kelurahanChartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
  if (currentSessionToken) {
    document.getElementById("lockOverlay").classList.add("hidden");
    document.getElementById("appContainer").classList.remove("hidden");
    loadStudentsData();
  }
});

async function handleLogin(event) {
  event.preventDefault();
  const passcode = document.getElementById("adminPasscode").value.trim();
  Swal.fire({ title: 'Memverifikasi Passcode...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  try {
    const res = await apiCall('login', { passcode });
    if (res && res.success && res.token) {
      currentSessionToken = res.token;
      sessionStorage.setItem('sdqu_token', currentSessionToken);
      Swal.fire({ icon: 'success', title: 'Login Berhasil!', text: 'Selamat datang di Sistem Buku Induk SDQU An-Najaah', timer: 1500, showConfirmButton: false });
      document.getElementById("lockOverlay").classList.add("hidden");
      document.getElementById("appContainer").classList.remove("hidden");
      loadStudentsData();
    } else {
      Swal.fire({ icon: 'error', title: 'Akses Ditolak', text: res.message || 'Passcode salah.' });
    }
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Koneksi Gagal', text: err.message });
  }
}

function handleLogout() {
  sessionStorage.removeItem('sdqu_token');
  currentSessionToken = null;
  document.getElementById("appContainer").classList.add("hidden");
  document.getElementById("lockOverlay").classList.remove("hidden");
  document.getElementById("adminPasscode").value = "";
}

async function apiCall(action, payload = {}) {
  const url = CONFIG.GAS_API_URL;
  const bodyData = {
    action: action,
    token: currentSessionToken,
    ...payload
  };

  const response = await fetch(url, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(bodyData)
  });

  const textRes = await response.text();
  try {
    return JSON.parse(textRes);
  } catch (e) {
    throw new Error("Respon server tidak valid: " + textRes.substring(0, 100));
  }
}

async function loadStudentsData(showToast = false) {
  if (showToast) {
    Swal.fire({ title: 'Memperbarui Data...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  }
  try {
    const res = await apiCall('getStudents');
    if (res && res.success) {
      globalStudentsData = res.data || [];
      renderDashboard(res.stats || {});
      renderTable(globalStudentsData);
      if (showToast) Swal.close();
    } else {
      if (res && res.unauthorized) {
        handleLogout();
      } else {
        throw new Error(res.message || 'Gagal mengambil data siswa.');
      }
    }
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Gagal Memuat Data', text: err.message });
  }
}

function togglePrivacyMode() {
  isPrivacyMasked = !isPrivacyMasked;
  const icon = document.getElementById("privacyIcon");
  const text = document.getElementById("privacyText");
  if (isPrivacyMasked) {
    icon.className = "fa-solid fa-eye-slash";
    text.textContent = "Sensor PII Aktif";
  } else {
    icon.className = "fa-solid fa-eye";
    text.textContent = "Data Terbuka";
  }
  renderTable(globalStudentsData);
}

function maskSensitiveData(str, type) {
  if (!str) return '-';
  if (!isPrivacyMasked) return str;
  if (type === 'nik' || type === 'kk') {
    if (str.length > 8) {
      return str.substring(0, 6) + '********' + str.substring(str.length - 2);
    }
    return '********';
  }
  if (type === 'phone') {
    if (str.length > 4) {
      return str.substring(0, 4) + '****' + str.substring(str.length - 2);
    }
    return '****';
  }
  return str;
}

function normalizePhoneWa(phone) {
  if (!phone) return '#';
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.substring(1);
  } else if (!clean.startsWith('62')) {
    clean = '62' + clean;
  }
  return `https://wa.me/${clean}`;
}

function renderDashboard(stats) {
  document.getElementById("kpiTotal").textContent = stats.total || 0;
  document.getElementById("kpiMale").textContent = stats.male || 0;
  document.getElementById("kpiFemale").textContent = stats.female || 0;
  document.getElementById("kpiComplete").textContent = stats.completeDocs || 0;

  // Render Charts
  const tkCtx = document.getElementById("tkChart").getContext('2d');
  if (tkChartInstance) tkChartInstance.destroy();
  tkChartInstance = new Chart(tkCtx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(stats.tkDistribution || {}),
      datasets: [{
        data: Object.values(stats.tkDistribution || {}),
        backgroundColor: ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#047857']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  const kelCtx = document.getElementById("kelurahanChart").getContext('2d');
  if (kelurahanChartInstance) kelurahanChartInstance.destroy();
  kelurahanChartInstance = new Chart(kelCtx, {
    type: 'bar',
    data: {
      labels: Object.keys(stats.kelurahanDistribution || {}).slice(0, 6),
      datasets: [{
        label: 'Jumlah Siswa',
        data: Object.values(stats.kelurahanDistribution || {}).slice(0, 6),
        backgroundColor: '#059669'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });
}

function renderTable(dataList) {
  const tbody = document.getElementById("tableBody");
  if (!dataList || dataList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-400">Tidak ada data siswa ditemukan.</td></tr>`;
    return;
  }

  let html = '';
  dataList.forEach((s, index) => {
    const thumb = s.drives && s.drives.pasFoto && s.drives.pasFoto.thumbnailUrl ? s.drives.pasFoto.thumbnailUrl : 'https://via.placeholder.com/150?text=Foto';
    const waAyah = normalizePhoneWa(s.ayah?.hp);
    const maskedNik = maskSensitiveData(s.nik, 'nik');
    const maskedKK = maskSensitiveData(s.kk, 'kk');
    const maskedHp = maskSensitiveData(s.ayah?.hp, 'phone');

    html += `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="py-3 px-4 font-medium text-slate-500">${index + 1}</td>
        <td class="py-3 px-4"><img src="${thumb}" class="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm" alt="Foto"></td>
        <td class="py-3 px-4">
          <div class="font-bold text-slate-900">${escapeHtml(s.nama)}</div>
          <div class="text-xs text-slate-500">${escapeHtml(s.jk)}</div>
        </td>
        <td class="py-3 px-4 font-mono text-xs">
          <div>NIK: ${maskedNik}</div>
          <div class="text-slate-400">KK: ${maskedKK}</div>
        </td>
        <td class="py-3 px-4 text-xs">
          <div class="font-medium text-slate-800">${escapeHtml(s.ayah?.nama || '-')}</div>
          <a href="${waAyah}" target="_blank" class="text-emerald-600 hover:underline flex items-center gap-1 mt-0.5"><i class="fa-brands fa-whatsapp"></i> ${maskedHp}</a>
        </td>
        <td class="py-3 px-4 text-xs">${escapeHtml(s.tk?.namaAsal || '-')}</td>
        <td class="py-3 px-4 text-center">
          <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${s.isCompleteDocs ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
            ${s.isCompleteDocs ? 'Lengkap' : 'Belum Lengkap'}
          </span>
        </td>
        <td class="py-3 px-4 text-center">
          <div class="flex items-center justify-center gap-2">
            <button onclick="openDetailModal(${s.rowIndex})" class="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center transition" title="Detail Lengkap"><i class="fa-solid fa-eye"></i></button>
            <button onclick="openEditStudent(${s.rowIndex})" class="w-8 h-8 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 flex items-center justify-center transition" title="Edit Data"><i class="fa-solid fa-pen"></i></button>
          </div>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function filterTable() {
  const query = document.getElementById("searchInput").value.toLowerCase();
  const filtered = globalStudentsData.filter(s => {
    return (
      (s.nama && s.nama.toLowerCase().includes(query)) ||
      (s.nik && s.nik.toLowerCase().includes(query)) ||
      (s.kk && s.kk.toLowerCase().includes(query)) ||
      (s.ayah && s.ayah.nama && s.ayah.nama.toLowerCase().includes(query)) ||
      (s.ibu && s.ibu.nama && s.ibu.nama.toLowerCase().includes(query)) ||
      (s.tk && s.tk.namaAsal && s.tk.namaAsal.toLowerCase().includes(query)) ||
      (s.alamat && s.alamat.kelurahan && s.alamat.kelurahan.toLowerCase().includes(query))
    );
  });
  renderTable(filtered);
}

function switchDetailTab(tabIndex) {
  const buttons = document.querySelectorAll('#detailTabsHeader .tab-btn');
  buttons.forEach((btn, idx) => {
    if (idx === tabIndex) {
      btn.className = "tab-btn px-4 py-2 border-b-2 border-emerald-600 text-emerald-700 font-bold bg-white rounded-t-lg";
    } else {
      btn.className = "tab-btn px-4 py-2 border-b-2 border-transparent hover:text-slate-900";
    }
  });
  renderDetailContent(tabIndex);
}

let activeStudentDetail = null;

function openDetailModal(rowIndex) {
  const student = globalStudentsData.find(s => s.rowIndex === rowIndex);
  if (!student) return;
  activeStudentDetail = student;
  switchDetailTab(0);
  document.getElementById("detailModal").classList.remove("hidden");
  document.getElementById("detailModal").classList.add("flex");
}

function closeDetailModal() {
  document.getElementById("detailModal").classList.add("hidden");
  document.getElementById("detailModal").classList.remove("flex");
}

function renderDetailContent(tabIndex) {
  const s = activeStudentDetail;
  if (!s) return;
  const container = document.getElementById("detailModalContent");
  let html = '';

  if (tabIndex === 0) {
    html = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div><span class="text-xs text-slate-400 block">Nama Lengkap</span><strong>${escapeHtml(s.nama)}</strong></div>
        <div><span class="text-xs text-slate-400 block">Jenis Kelamin</span><strong>${escapeHtml(s.jk)}</strong></div>
        <div><span class="text-xs text-slate-400 block">NIK</span><strong class="font-mono">${maskSensitiveData(s.nik, 'nik')}</strong></div>
        <div><span class="text-xs text-slate-400 block">No. KK</span><strong class="font-mono">${maskSensitiveData(s.kk, 'kk')}</strong></div>
        <div><span class="text-xs text-slate-400 block">Tempat, Tanggal Lahir</span><strong>${escapeHtml(s.ttl)}</strong></div>
        <div><span class="text-xs text-slate-400 block">No. Akta Lahir</span><strong>${escapeHtml(s.akta)}</strong></div>
        <div><span class="text-xs text-slate-400 block">Hobi / Cita-cita</span><strong>${escapeHtml(s.hobi)} / ${escapeHtml(s.citaCita)}</strong></div>
        <div><span class="text-xs text-slate-400 block">Berkebutuhan Khusus?</span><strong>${escapeHtml(s.berkebutuhanKhusus)}</strong></div>
      </div>
    `;
  } else if (tabIndex === 1) {
    html = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div class="sm:col-span-2"><span class="text-xs text-slate-400 block">Alamat Jalan</span><strong>${escapeHtml(s.alamat?.jalan)}</strong></div>
        <div><span class="text-xs text-slate-400 block">RT / RW</span><strong>${escapeHtml(s.alamat?.rtrw)}</strong></div>
        <div><span class="text-xs text-slate-400 block">Kelurahan</span><strong>${escapeHtml(s.alamat?.kelurahan)}</strong></div>
        <div><span class="text-xs text-slate-400 block">Kecamatan</span><strong>${escapeHtml(s.alamat?.kecamatan)}</strong></div>
        <div><span class="text-xs text-slate-400 block">Jarak & Waktu Tempuh</span><strong>${escapeHtml(s.alamat?.jarak)} (${escapeHtml(s.alamat?.waktuTempuh)})</strong></div>
      </div>
    `;
  } else if (tabIndex === 2) {
    html = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div><span class="text-xs text-slate-400 block">Nama Ayah</span><strong>${escapeHtml(s.ayah?.nama)}</strong></div>
        <div><span class="text-xs text-slate-400 block">NIK Ayah</span><strong class="font-mono">${maskSensitiveData(s.ayah?.nik, 'nik')}</strong></div>
        <div><span class="text-xs text-slate-400 block">No. HP / WA Ayah</span><strong>${maskSensitiveData(s.ayah?.hp, 'phone')}</strong></div>
        <div><span class="text-xs text-slate-400 block">Tahun Lahir Ayah</span><strong>${escapeHtml(s.ayah?.tahunLahir)}</strong></div>
        <div><span class="text-xs text-slate-400 block">Pendidikan / Pekerjaan</span><strong>${escapeHtml(s.ayah?.pendidikan)} / ${escapeHtml(s.ayah?.pekerjaan)}</strong></div>
        <div><span class="text-xs text-slate-400 block">Penghasilan</span><strong>${escapeHtml(s.ayah?.penghasilan)}</strong></div>
      </div>
    `;
  } else if (tabIndex === 3) {
    html = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div><span class="text-xs text-slate-400 block">Nama Ibu</span><strong>${escapeHtml(s.ibu?.nama)}</strong></div>
        <div><span class="text-xs text-slate-400 block">NIK Ibu</span><strong class="font-mono">${maskSensitiveData(s.ibu?.nik, 'nik')}</strong></div>
        <div><span class="text-xs text-slate-400 block">No. HP / WA Ibu</span><strong>${maskSensitiveData(s.ibu?.hp, 'phone')}</strong></div>
        <div><span class="text-xs text-slate-400 block">Tahun Lahir Ibu</span><strong>${escapeHtml(s.ibu?.tahunLahir)}</strong></div>
        <div><span class="text-xs text-slate-400 block">Pendidikan / Pekerjaan</span><strong>${escapeHtml(s.ibu?.pendidikan)} / ${escapeHtml(s.ibu?.pekerjaan)}</strong></div>
        <div><span class="text-xs text-slate-400 block">Penghasilan</span><strong>${escapeHtml(s.ibu?.penghasilan)}</strong></div>
      </div>
    `;
  } else if (tabIndex === 4) {
    html = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div><span class="text-xs text-slate-400 block">Punya Wali?</span><strong>${escapeHtml(s.wali?.punyaWali)}</strong></div>
        <div><span class="text-xs text-slate-400 block">Nama Wali</span><strong>${escapeHtml(s.wali?.nama || '-')}</strong></div>
        <div><span class="text-xs text-slate-400 block">No. HP Wali</span><strong>${maskSensitiveData(s.wali?.hp, 'phone')}</strong></div>
        <div><span class="text-xs text-slate-400 block">Pekerjaan Wali</span><strong>${escapeHtml(s.wali?.pekerjaan || '-')}</strong></div>
      </div>
    `;
  } else if (tabIndex === 5) {
    const d = s.drives || {};
    html = `
      <div class="space-y-4 text-sm">
        <div><span class="text-xs text-slate-400 block">Asal TK</span><strong>${escapeHtml(s.tk?.namaAsal)} (Lulus: ${escapeHtml(s.tk?.tahunLulus)})</strong></div>
        <div><span class="text-xs text-slate-400 block">Kesehatan</span><strong>Gol. Darah: ${escapeHtml(s.kesehatan?.golDarah)}, TB/BB: ${escapeHtml(s.kesehatan?.tinggiBadan)}cm / ${escapeHtml(s.kesehatan?.beratBadan)}kg, Alergi: ${escapeHtml(s.kesehatan?.alergi)}</strong></div>
        <div class="border-t pt-3">
          <h5 class="font-bold text-xs text-slate-600 mb-2">Berkas Lampiran Google Drive</h5>
          <div class="flex flex-wrap gap-2">
            ${d.akta?.originalUrl ? `<a href="${d.akta.originalUrl}" target="_blank" class="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 flex items-center gap-1"><i class="fa-solid fa-file-pdf"></i> Akta Kelahiran</a>` : ''}
            ${d.kk?.originalUrl ? `<a href="${d.kk.originalUrl}" target="_blank" class="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 flex items-center gap-1"><i class="fa-solid fa-file-pdf"></i> Kartu Keluarga</a>` : ''}
            ${d.ijazahTk?.originalUrl ? `<a href="${d.ijazahTk.originalUrl}" target="_blank" class="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 flex items-center gap-1"><i class="fa-solid fa-file-pdf"></i> Ijazah TK</a>` : ''}
            ${d.pasFoto?.originalUrl ? `<a href="${d.pasFoto.originalUrl}" target="_blank" class="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 flex items-center gap-1"><i class="fa-solid fa-image"></i> Pas Foto</a>` : ''}
          </div>
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
}

function openStudentFormModal(rowIndex = null) {
  document.getElementById("studentForm").reset();
  document.getElementById("formRowIndex").value = "";
  if (rowIndex !== null) {
    const s = globalStudentsData.find(item => item.rowIndex === rowIndex);
    if (s) {
      document.getElementById("formRowIndex").value = s.rowIndex;
      document.getElementById("f_Nama").value = s.nama || '';
      document.getElementById("f_JK").value = s.jk || 'Laki-laki';
      document.getElementById("f_NIK").value = s.nik || '';
      document.getElementById("f_KK").value = s.kk || '';
      document.getElementById("f_TTL").value = s.ttl || '';
      document.getElementById("f_Akta").value = s.akta || '';
      document.getElementById("f_Alamat").value = s.alamat?.jalan || '';
      document.getElementById("f_RTRW").value = s.alamat?.rtrw || '';
      document.getElementById("f_Kelurahan").value = s.alamat?.kelurahan || '';
      document.getElementById("f_Kecamatan").value = s.alamat?.kecamatan || '';
      document.getElementById("f_NamaAyah").value = s.ayah?.nama || '';
      document.getElementById("f_HPAyah").value = s.ayah?.hp || '';
      document.getElementById("f_NamaIbu").value = s.ibu?.nama || '';
      document.getElementById("f_HPIbu").value = s.ibu?.hp || '';
      document.getElementById("f_AsalTK").value = s.tk?.namaAsal || '';
    }
  }
  document.getElementById("studentFormModal").classList.remove("hidden");
  document.getElementById("studentFormModal").classList.add("flex");
}

function closeStudentFormModal() {
  document.getElementById("studentFormModal").classList.add("hidden");
  document.getElementById("studentFormModal").classList.remove("flex");
}

function openEditStudent(rowIndex) {
  openStudentFormModal(rowIndex);
}

async function compressImageToBase64(file, maxDim = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
}

async function handleFormSubmit(event) {
  event.preventDefault();
  Swal.fire({ title: 'Menyimpan Data...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  const rowIndex = document.getElementById("formRowIndex").value;
  const fileInput = document.getElementById("f_PasFotoFile");
  let base64Photo = null;
  let photoName = null;
  let photoType = null;

  if (fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    base64Photo = await compressImageToBase64(file);
    photoName = file.name;
    photoType = file.type;
  }

  const payload = {
    rowIndex: rowIndex ? parseInt(rowIndex) : null,
    nama: document.getElementById("f_Nama").value,
    jk: document.getElementById("f_JK").value,
    nik: document.getElementById("f_NIK").value,
    kk: document.getElementById("f_KK").value,
    ttl: document.getElementById("f_TTL").value,
    akta: document.getElementById("f_Akta").value,
    alamat: document.getElementById("f_Alamat").value,
    rtrw: document.getElementById("f_RTRW").value,
    kelurahan: document.getElementById("f_Kelurahan").value,
    kecamatan: document.getElementById("f_Kecamatan").value,
    namaAyah: document.getElementById("f_NamaAyah").value,
    hpAyah: document.getElementById("f_HPAyah").value,
    namaIbu: document.getElementById("f_NamaIbu").value,
    hpIbu: document.getElementById("f_HPIbu").value,
    asalTk: document.getElementById("f_AsalTK").value,
    pasFoto: base64Photo,
    pasFotoName: photoName,
    pasFotoType: photoType
  };

  try {
    const res = await apiCall('saveStudent', payload);
    if (res && res.success) {
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Data siswa berhasil disimpan.', timer: 1500, showConfirmButton: false });
      closeStudentFormModal();
      loadStudentsData();
    } else {
      Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: res.message || 'Terjadi kesalahan pada server.' });
    }
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Error Koneksi', text: err.message });
  }
}

function printStudentBiodata() {
  if (!activeStudentDetail) return;
  const s = activeStudentDetail;
  const printArea = document.getElementById("printArea");
  printArea.innerHTML = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #000;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
        <h2>SDQU AN-NAJAAH</h2>
        <h3>FORMULIR BUKU INDUK PESERTA DIDIK</h3>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 15px;">
        <tr><td style="width: 30%; padding: 4px;"><strong>Nama Lengkap</strong></td><td style="width: 70%; padding: 4px;">: ${s.nama}</td></tr>
        <tr><td style="padding: 4px;"><strong>Jenis Kelamin</strong></td><td style="padding: 4px;">: ${s.jk}</td></tr>
        <tr><td style="padding: 4px;"><strong>NIK / No. KK</strong></td><td style="padding: 4px;">: ${s.nik} / ${s.kk}</td></tr>
        <tr><td style="padding: 4px;"><strong>Tempat, Tanggal Lahir</strong></td><td style="padding: 4px;">: ${s.ttl}</td></tr>
        <tr><td style="padding: 4px;"><strong>Alamat</strong></td><td style="padding: 4px;">: ${s.alamat?.jalan}, RT/RW ${s.alamat?.rtrw}, Kel. ${s.alamat?.kelurahan}, Kec. ${s.alamat?.kecamatan}</td></tr>
        <tr><td style="padding: 4px;"><strong>Nama Ayah / Ibu</strong></td><td style="padding: 4px;">: ${s.ayah?.nama} / ${s.ibu?.nama}</td></tr>
        <tr><td style="padding: 4px;"><strong>Asal TK</strong></td><td style="padding: 4px;">: ${s.tk?.namaAsal}</td></tr>
      </table>
    </div>
  `;
  window.print();
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
