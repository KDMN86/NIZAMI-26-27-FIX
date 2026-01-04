// ==========================================
// 🚀 SYSTEM CORE PAKET NIZAMI (FINAL V6 - COUNTER FOCUS)
// ==========================================

const CONFIG = {
  sheetPeserta: 'DATA_PESERTA',
  sheetTransaksi: 'TRANSAKSI',
  sheetBarang: 'MASTER_BARANG',
  sheetPaket: 'MASTER_PAKET',
  sheetIsiPaket: 'MASTER_ISI_PAKET',
  sheetMitra: 'MASTER_MITRA',
  sheetRekap: 'REKAP_BELANJA',
  sheetGallery: 'GALLERY',
  folderGalleryID: '18wD2brS3QZ8-oW_zeNONyJbpYMg2NSGJvTQ-9TG0GNM' 
};

// --- 1. API GATEWAY ---

function doGet(e) {
  const act = e.parameter.action;

  // PUBLIC READ
  if(act === 'getMitra') return getListMitra();
  if(act === 'getPaket') return getListPaket();
  if(act === 'getBarang') return getListBarang();
  if(act === 'getGallery') return getGalleryData();
  
  // CEK STATUS (Digunakan oleh cek-status.html)
  if(act === 'cekStatusDetail') return cekStatusDetail(e.parameter.id);

  // ADMIN FEATURES
  if(act === 'getAdminStats') return getAdminStats();
  if(act === 'cariPeserta') return cariPeserta(e.parameter.q);
  if(act === 'updateHarga') return updateHargaBarang(e.parameter);
  if(act === 'tambahBarang') return tambahBarangBaru(e.parameter);
  if(act === 'tambahPeserta') return tambahPesertaBaru(e.parameter);
  if(act === 'tambahMitra') return tambahMitraBaru(e.parameter);
  if(act === 'getRekapBelanja') return hitungRekapBelanja();

  // TRANSAKSI (GET method support for script.js compatibility)
  if(act === 'daftarPeserta') return daftarPeserta(e.parameter);
  if(act === 'inputSetoran') return inputSetoran(e.parameter);

  return responseJSON({error: 'Invalid Action'});
}

function doPost(e) {
  const act = e.parameter.action;
  // Upload File wajib POST
  if(act === 'uploadImage') return uploadImageToDrive(e);
  return responseJSON({error: 'Invalid Action (POST)'});
}

// --- 2. SETUP DATABASE ---
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const structure = [
    { name: CONFIG.sheetPeserta, headers: ['ID Peserta', 'Tanggal Daftar', 'Nama', 'No HP', 'Alamat', 'Mitra', 'Jenis Paket', 'Harga Paket', 'Status', 'Rincian Pesanan'] },
    // KOLOM BARU: J=Setoran Ke, K=Sisa Tagihan
    { name: CONFIG.sheetTransaksi, headers: ['ID Transaksi', 'Tanggal', 'Tipe', 'Kategori', 'Nominal Fisik (Rp)', 'Potongan Fee (Rp)', 'Nilai Efektif (Saldo)', 'Keterangan', 'Ref ID', 'Setoran Ke', 'Sisa Tagihan'] },
    { name: CONFIG.sheetBarang, headers: ['Kategori', 'Nama Barang', 'Harga Beli (HPP)', 'Satuan'] },
    { name: CONFIG.sheetPaket, headers: ['Nama Paket', 'Harga Jual', 'Jenis (Barang/Uang)', 'Fee Harian (Khusus Uang)'] },
    { name: CONFIG.sheetIsiPaket, headers: ['Nama Paket', 'Nama Barang', 'Qty Per Paket', 'Satuan'] },
    { name: CONFIG.sheetMitra, headers: ['ID Mitra', 'Nama Mitra', 'No HP', 'Alamat', 'Fee Per Peserta'] },
    { name: CONFIG.sheetRekap, headers: ['Nama Barang', 'Total Kebutuhan', 'Satuan', 'Status Stok'] },
    { name: CONFIG.sheetGallery, headers: ['ID', 'URL', 'Nama File', 'Tanggal'] }
  ];

  structure.forEach(s => {
    let sheet = ss.getSheetByName(s.name);
    if (!sheet) {
      sheet = ss.insertSheet(s.name);
      try { sheet.deleteRows(100, sheet.getMaxRows() - 100); } catch(e){}
    }
    if (sheet.getRange(1, 1).isBlank()) {
      sheet.getRange(1, 1, 1, s.headers.length).setValues([s.headers])
           .setFontWeight("bold").setBackground("#073116").setFontColor("#ffffff");
    }
  });
}

// --- 3. FUNGSI UTAMA (TRANSAKSI) ---

function daftarPeserta(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.sheetPeserta);
  
  const urutan = sheet.getLastRow(); 
  const idPeserta = 'NZM-26-' + String(urutan).padStart(3, '0');
  
  sheet.appendRow([
    idPeserta, new Date(), data.nama, "'" + data.hp, data.alamat, 
    data.mitra, data.paket, data.harga || 0, 'Aktif', data.rincian || '-'
  ]);
  
  return responseJSON({success: true, id: idPeserta, nama: data.nama});
}

// UPDATE PENTING: MENGHITUNG SETORAN KE BERAPA
function inputSetoran(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetTrx = ss.getSheetByName(CONFIG.sheetTransaksi);
  const sheetPeserta = ss.getSheetByName(CONFIG.sheetPeserta);
  const sheetPaket = ss.getSheetByName(CONFIG.sheetPaket);
  
  // 1. Cari Paket Peserta
  const dataPeserta = sheetPeserta.getDataRange().getValues();
  let jenisPaket = '';
  for(let i=1; i<dataPeserta.length; i++){
    if(String(dataPeserta[i][0]) === String(data.idPeserta)) {
      jenisPaket = dataPeserta[i][6];
      break;
    }
  }
  
  if(!jenisPaket) return responseJSON({error: 'ID Peserta Tidak Ditemukan'});

  // 2. Hitung Setoran Ke Berapa
  const dataTrx = sheetTrx.getDataRange().getValues();
  let countSudahBayar = 0;
  for(let i=1; i<dataTrx.length; i++){
    if(String(dataTrx[i][8]) === String(data.idPeserta) && dataTrx[i][2] === 'MASUK') {
      countSudahBayar++;
    }
  }
  const setoranKe = countSudahBayar + 1;

  // 3. Tentukan Target & Sisa
  let targetTotal = 330; 
  if (String(jenisPaket).toLowerCase().includes('mingguan')) targetTotal = 40;
  const sisa = targetTotal - setoranKe;

  // 4. Hitung Nominal & Fee
  const dataMaster = sheetPaket.getDataRange().getValues();
  let fee = 0;
  for(let i=1; i<dataMaster.length; i++){
    if(dataMaster[i][0] === jenisPaket && dataMaster[i][2] === 'Uang') {
      fee = Number(dataMaster[i][3]); 
    }
  }

  const nominalFisik = Number(data.nominal);
  const nilaiEfektif = nominalFisik - fee;

  // 5. Simpan (Kolom J dan K terisi)
  sheetTrx.appendRow([
    'TRX-' + Date.now(), new Date(), 'MASUK', 'Setoran Tabungan',
    nominalFisik, fee, nilaiEfektif, `Setoran ${jenisPaket}`, 
    data.idPeserta, setoranKe, sisa
  ]);

  return responseJSON({
    success: true, 
    msg: `Setoran ke-${setoranKe} Berhasil. Sisa ${sisa}x lagi.`
  });
}

// --- UPDATE CODE.GS (FIXED MITRA DETAIL) ---

function cekStatusDetail(idInput) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const idCari = String(idInput).trim().toUpperCase();

  // 1. CEK DATA MITRA
  const sheetMitra = ss.getSheetByName(CONFIG.sheetMitra);
  const dataMitra = sheetMitra.getDataRange().getValues();
  let mitraFound = null;

  for(let i=1; i<dataMitra.length; i++){
    if(String(dataMitra[i][0]).toUpperCase() === idCari || String(dataMitra[i][1]).toUpperCase() === idCari) {
      mitraFound = dataMitra[i][1]; // Ambil Nama Mitra
      break;
    }
  }

  // JIKA MITRA DITEMUKAN -> AMBIL SEMUA ANAK BUAH LENGKAP DENGAN DATA SETORAN
  if(mitraFound) {
    const sheetPeserta = ss.getSheetByName(CONFIG.sheetPeserta);
    const dataP = sheetPeserta.getDataRange().getValues();
    const sheetTrx = ss.getSheetByName(CONFIG.sheetTransaksi);
    const dataT = sheetTrx.getDataRange().getValues();
    
    let listAnak = [];

    // Loop semua peserta
    for(let i=1; i<dataP.length; i++){
      // Cek Kolom F (Mitra) - Case Insensitive
      if(String(dataP[i][5]).trim().toUpperCase() === String(mitraFound).trim().toUpperCase()) {
        
        let pID = dataP[i][0];
        let pNama = dataP[i][2];
        let pPaket = dataP[i][6];
        
        // HITUNG MANUAL SETORAN PESERTA INI
        let pCount = 0;
        let pSaldo = 0;
        
        for(let j=1; j<dataT.length; j++){
          // Cek Ref ID (Kolom I / Index 8) dan Status MASUK
          if(String(dataT[j][8]) === String(pID) && dataT[j][2] === 'MASUK') {
            pCount++;
            pSaldo += Number(dataT[j][6]); // Nilai Efektif
          }
        }

        // Tentukan Target
        let pTarget = String(pPaket).toLowerCase().includes('mingguan') ? 40 : 330;
        
        // Push Data Lengkap ke Array (Kunci perbaikan ada disini)
        listAnak.push({
          idPeserta: pID,          // Frontend minta idPeserta
          nama: pNama,
          jenisPaket: pPaket,      // Frontend minta jenisPaket
          setoranDilakukan: pCount,// Frontend minta setoranDilakukan
          totalSetoran: pTarget,   // Frontend minta totalSetoran
          sisaSetoran: pTarget - pCount,
          nilaiSetoran: pSaldo
        });
      }
    }
    return responseJSON({type: 'MITRA', nama: mitraFound, data: listAnak});
  }

  // 2. JIKA BUKAN MITRA -> CEK DATA PESERTA SATUAN (Kode Lama)
  const sheetPeserta = ss.getSheetByName(CONFIG.sheetPeserta);
  const dataP = sheetPeserta.getDataRange().getValues();
  let info = null;
  
  for(let i=1; i<dataP.length; i++){
    if(String(dataP[i][0]).toUpperCase() === idCari) {
      info = {
        id: dataP[i][0], 
        nama: dataP[i][2], 
        paket: dataP[i][6],
        rincian: dataP[i][9]
      };
      break;
    }
  }
  
  if(!info) return responseJSON({error: "Data tidak ditemukan"});

  // Hitung Detail Transaksi
  const sheetTrx = ss.getSheetByName(CONFIG.sheetTransaksi);
  const dataT = sheetTrx.getDataRange().getValues();
  let totalMasuk = 0;
  let jumlahSetor = 0;
  let listTanggal = [];
  
  for(let i=1; i<dataT.length; i++){
    if(String(dataT[i][8]).toUpperCase() === idCari && dataT[i][2] === 'MASUK') {
      totalMasuk += Number(dataT[i][6]);
      jumlahSetor++;
      listTanggal.push(new Date(dataT[i][1]).getTime());
    }
  }
  
  let target = String(info.paket).toLowerCase().includes('mingguan') ? 40 : 330;

  return responseJSON({
    type: 'PESERTA',
    data: [{
      idPeserta: info.id,
      nama: info.nama,
      jenisPaket: info.paket,
      nilaiSetoran: totalMasuk,
      setoranDilakukan: jumlahSetor,
      totalSetoran: target,
      sisaSetoran: target - jumlahSetor,
      setoranBarang: info.rincian,
      trxDates: listTanggal
    }]
  });
}

// --- 5. FUNGSI ADMIN LAINNYA ---

function tambahBarangBaru(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheetByName(CONFIG.sheetBarang).appendRow([data.kategori, data.nama, Number(data.harga), data.satuan]);
  return responseJSON({success: true});
}

function updateHargaBarang(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheetBarang);
  const rows = sheet.getDataRange().getValues();
  for(let i=1; i<rows.length; i++){
    if(String(rows[i][1]).trim().toLowerCase() === String(data.nama).trim().toLowerCase()) {
      sheet.getRange(i+1, 3).setValue(Number(data.hargaBaru));
      return responseJSON({success: true});
    }
  }
  return responseJSON({error: "Barang tidak ditemukan"});
}

function tambahPesertaBaru(data) {
  return daftarPeserta(data); // Reuse fungsi
}

function tambahMitraBaru(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.sheetMitra);
  const id = 'MITRA-' + String(sheet.getLastRow()).padStart(3, '0');
  sheet.appendRow([id, data.nama, "'" + data.hp, data.alamat, 0]);
  return responseJSON({success: true});
}

function getAdminStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const totalPeserta = Math.max(0, ss.getSheetByName(CONFIG.sheetPeserta).getLastRow() - 1);
  const dataTrx = ss.getSheetByName(CONFIG.sheetTransaksi).getDataRange().getValues();
  let totalUang = 0; let trxHariIni = 0; const todayStr = new Date().toDateString();
  for(let i=1; i<dataTrx.length; i++){
    if(dataTrx[i][2] === 'MASUK') {
      totalUang += Number(dataTrx[i][4] || 0);
      if(new Date(dataTrx[i][1]).toDateString() === todayStr) trxHariIni++;
    }
  }
  return responseJSON({peserta: totalPeserta, uang: totalUang, trxToday: trxHariIni});
}

function cariPeserta(query) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheetPeserta);
  const data = sheet.getDataRange().getValues();
  let hasil = [];
  const q = String(query).toLowerCase();
  for(let i=1; i<data.length; i++){
    if(String(data[i][2]).toLowerCase().includes(q) || String(data[i][0]).toLowerCase().includes(q)) {
      hasil.push({id: data[i][0], nama: data[i][2], paket: data[i][6]});
      if(hasil.length >= 10) break; 
    }
  }
  return responseJSON(hasil);
}

function hitungRekapBelanja() {
  // (Fungsi ini tetap sama, disederhanakan untuk menghemat karakter)
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataP = ss.getSheetByName(CONFIG.sheetPeserta).getDataRange().getValues();
  let count = {};
  for(let i=1; i<dataP.length; i++) { let p = dataP[i][6]; if(p) count[p] = (count[p]||0)+1; }
  
  const dataResep = ss.getSheetByName(CONFIG.sheetIsiPaket).getDataRange().getValues();
  let rekap = {};
  for(let i=1; i<dataResep.length; i++){
    let [pkt, brg, qty, sat] = dataResep[i];
    if(count[pkt]) {
      if(!rekap[brg]) rekap[brg] = {qty:0, sat:sat};
      rekap[brg].qty += (count[pkt] * Number(qty));
    }
  }
  let arr = []; for(let k in rekap) arr.push({barang:k, total:rekap[k].qty, satuan:rekap[k].sat});
  return responseJSON({paketCount: count, belanja: arr});
}

// --- HELPER ---
function getListMitra() { return getListCol(CONFIG.sheetMitra, 1); }
function getListPaket() { 
  const d = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheetPaket).getDataRange().getValues();
  return responseJSON(d.slice(1).map(r => ({nama: r[0], jenis: r[2]})));
}
function getListBarang() {
  const d = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheetBarang).getDataRange().getValues();
  return responseJSON(d.slice(1).map(r => ({kategori: r[0], nama: r[1], harga: r[2], satuan: r[3]})));
}
function getGalleryData() { return getListCol(CONFIG.sheetGallery, 1, true); }

function getListCol(sheetName, idx, isObj=false) {
  const d = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName).getDataRange().getValues();
  let r = []; for(let i=1; i<d.length; i++) r.push(isObj ? {url: d[i][idx]} : d[i][idx]);
  return responseJSON(r);
}

function uploadImageToDrive(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var blob = Utilities.newBlob(Utilities.base64Decode(data.fileData.split(",")[1]), data.fileData.substring(5, data.fileData.indexOf(';')), data.fileName);
    var file = DriveApp.getFolderById(CONFIG.folderGalleryID).createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var url = "https://drive.google.com/uc?export=view&id=" + file.getId();
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheetGallery).appendRow([file.getId(), url, data.fileName, new Date()]);
    return responseJSON({success: true, url: url});
  } catch (err) { return responseJSON({error: err.toString()}); }
}

function responseJSON(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }