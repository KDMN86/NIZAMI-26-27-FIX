// ===========================================
// CORE SCRIPT - PAKET NIZAMI 2026
// ===========================================

// ⚠️ GANTI INI DENGAN URL DEPLOYMENT GOOGLE SCRIPT ANDA ⚠️
const API_URL = 'https://script.google.com/macros/s/AKfycbwpWWkavdgttf1DV2OkhQWxyGuPnQUDGyMC82PleJKvfpZ_NlZVs2D1QhLty4tvSH3yrA/exec'; 

// Format Rupiah
const formatRupiah = (angka) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
};

// Fungsi Fetch Data Universal
async function fetchData(action, params = {}) {
  const url = new URL(API_URL);
  url.searchParams.append('action', action);
  for (const key in params) {
    url.searchParams.append(key, params[key]);
  }

  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error("Gagal mengambil data:", error);
    return null;
  }
}

// Fungsi Loading
function showLoading(elementId, msg = "Memuat data...") {
  const el = document.getElementById(elementId);
  if(el) el.innerHTML = `<div style="text-align:center; padding:20px; color:#aaa;"><i class="fas fa-spinner fa-spin"></i> ${msg}</div>`;
}

// Fungsi Kirim WA
function kirimWA(nomor, pesan) {
  const url = `https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`;
  window.open(url, '_blank');
}


// --- LOGIKA FORM MITRA ---
      
      function openMitra() { 
        document.getElementById('modalMitra').classList.add('show'); 
      }
      
      function closeMitra() { 
        document.getElementById('modalMitra').classList.remove('show'); 
        // Reset form saat ditutup
        document.getElementById('formMitra').reset();
        document.getElementById('checkSyaratMitra').checked = false;
        toggleFormMitra();
      }

      function toggleFormMitra() {
        const checked = document.getElementById('checkSyaratMitra').checked;
        const field = document.getElementById('fieldMitra');
        field.disabled = !checked;
        field.style.opacity = checked ? '1' : '0.5';
      }

      async function submitMitra(e) {
        e.preventDefault();
        const btn = document.getElementById('btnMitra');
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Sedang Mengirim...'; 
        btn.disabled = true;

        const data = Object.fromEntries(new FormData(e.target).entries());
        
        // Kirim ke Database (Action: tambahMitra)
        // Pastikan Code.gs V5 Anda sudah di-deploy (sudah support tambahMitra via GET)
        const result = await fetchData('tambahMitra', data);
        
        if (result && result.success) {
          // Kirim Notif WA ke Owner
          const pesan = `Assalamu'alaikum Owner, saya mengajukan diri jadi *MITRA NIZAMI*.%0A%0A👤 Nama: ${data.nama}%0A📱 WA: ${data.hp}%0A🏠 Alamat: ${data.alamat}%0A%0ASaya sudah membaca syarat & ketentuan (Shalat 5 waktu, Jujur, Target 10 Peserta). Mohon bimbingannya.`;
          
          kirimWA('628122261036', decodeURIComponent(pesan)); // Ganti No Owner
          
          alert('Pengajuan Berhasil! Silakan lanjut chat ke Owner.');
          closeMitra();
        } else {
          alert('Gagal mengirim data. Coba lagi.');
        }
        
        btn.innerHTML = originalText; 
        btn.disabled = false;
      }