"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Rekening = { type: "bank" | "wallet"; label: string; no: string; name: string };
type Orang = { nama: string; keterangan: string };

type Undangan = {
  id: number;
  slug: string;
  nama_anak: string;
  nama_orang_tua: string;
  tanggal: string;
  jam: string;
  lokasi: string;
  foto_cover: string;
  foto_acara: string;
  maps_url: string;
  hiburan: string;
  turut_mengundang: string[];
  orang_berbahagia: Orang[];
  rekening: Rekening[];
  ayat: string;
  akses_token?: string;
  // Dynamic fields
  judul_sampul?: string;
  tanggal_sampul?: string;
  label_acara?: string;
  tempat_singkat?: string;
  hari_acara?: string;
  tanggal_acara?: string;
  jam_acara?: string;
  sekeluarga?: string;
  alamat_keluarga?: string;
  footer_text?: string;
  musik_url?: string;
  musik_judul?: string;
  musik_start?: string;
  musik_end?: string;
};

export default function AdminPage() {
  const router = useRouter();
  const slug = process.env.NEXT_PUBLIC_FIXED_SLUG || "khitanan-zayyan-arkana-alfarizqi";
  const token = process.env.NEXT_PUBLIC_FIXED_TOKEN || "tokencontoh12345";

  const [editing, setEditing] = useState<Undangan | null>(null);
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState<{ text: string; tipe: "success" | "error" } | null>(null);
  const [uploading, setUploading] = useState<"cover" | "acara" | "musik" | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);

  const setTimeFromCurrent = (field: "musik_start" | "musik_end") => {
    const audio = previewAudioRef.current;
    if (!audio || !editing) return;
    const cur = audio.currentTime;
    const m = Math.floor(cur / 60);
    const s = Math.floor(cur % 60);
    const formatted = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    setEditing({ ...editing, [field]: formatted });
  };

  const testTrimmedPlay = () => {
    const audio = previewAudioRef.current;
    if (!audio || !editing) return;
    const parseSec = (val?: string) => {
      if (!val) return 0;
      if (val.includes(":")) {
        const [m, s] = val.split(":");
        return (parseFloat(m) || 0) * 60 + (parseFloat(s) || 0);
      }
      return parseFloat(val) || 0;
    };
    const start = parseSec(editing.musik_start);
    audio.currentTime = start;
    audio.play();
  };

  useEffect(() => {
    async function muat() {
      try {
        const res = await fetch(`/api/admin/u/${slug}?token=${token}`);
        if (!res.ok) {
          setPesan({
            text: "Gagal memuat data dari database. Pastikan token valid di .env.local",
            tipe: "error",
          });
          return;
        }
        const data = await res.json();
        const u = data.undangan;
        const dj = u.data_json || {};

        const parseJson = <T,>(val: unknown, fallback: T): T => {
          if (Array.isArray(val)) return val as T;
          if (typeof val === "string") {
            try {
              const parsed = JSON.parse(val);
              if (Array.isArray(parsed)) return parsed as T;
            } catch {}
          }
          return fallback;
        };

        const loadedOrangBerbahagia = parseJson<Orang[]>(u.orang_berbahagia, []);

        setEditing({
          ...u,
          judul_sampul: dj.judul_sampul || "UNDANGAN",
          tanggal_sampul: dj.tanggal_sampul || "Rabu, 18 November 2026",
          label_acara: dj.label_acara || "Khitanan :",
          tempat_singkat: dj.tempat_singkat || "Rambatan Kulon, November 2026",
          hari_acara: dj.hari_acara || "Rabu malam Kamis",
          tanggal_acara: dj.tanggal_acara || "18 – 19 November 2026",
          jam_acara:
            dj.jam_acara ||
            (u.jam ? `Pkl. ${String(u.jam).slice(0, 5)} Wib s/d Selesai` : "Pkl. 08.00 Wib s/d Selesai"),
          sekeluarga: dj.sekeluarga || "Sekeluarga",
          alamat_keluarga:
            dj.alamat_keluarga ||
            "Desa Rambatan Kulon (Bangkir) Rt. 07 Rw. 01\nblok Kangkung Kec. Lohbener\nKab. Indramayu",
          footer_text: dj.footer_text || "Terima kasih atas do'a restu Bapak/Ibu/Saudara/i",
          turut_mengundang: parseJson<string[]>(u.turut_mengundang, []),
          orang_berbahagia:
            loadedOrangBerbahagia.length > 0
              ? loadedOrangBerbahagia
              : [
                  {
                    nama: "Bpk. KASTAM",
                    keterangan: "Bin Bpk. Rekiwan, Alm. - Ibu Minah, Almh.\n(Telukagung)",
                  },
                  {
                    nama: "Ibu SARINIH",
                    keterangan: "Binti Bpk. Kartam, Alm. - Ibu Sari, Almh.\n(Rambatan Kulon-Bangkir)",
                  },
                ],
          rekening: parseJson<Rekening[]>(u.rekening, []),
          musik_url: dj.musik_url || "",
          musik_judul: dj.musik_judul || "",
          musik_start: dj.musik_start || "",
          musik_end: dj.musik_end || "",
          akses_token: u.akses_token || "bumarpuah",
        });
      } catch (err) {
        setPesan({ text: "Terjadi kesalahan saat memuat data: " + String(err), tipe: "error" });
      }
    }
    if (slug && token) {
      muat();
    }
  }, [slug, token]);

  async function handleSave() {
    if (!editing) return;
    setLoading(true);
    setPesan(null);

    try {
      const res = await fetch(`/api/admin/u/${slug}?token=${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });

      if (res.ok) {
        setPesan({
          text: "Berhasil! Seluruh perubahan tersimpan dan langsung aktif pada halaman undangan.",
          tipe: "success",
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        setPesan({
          text: "Gagal menyimpan perubahan: " + (errData.error || res.statusText),
          tipe: "error",
        });
      }
    } catch (err) {
      setPesan({ text: "Terjadi kesalahan saat menyimpan: " + String(err), tipe: "error" });
    } finally {
      setLoading(false);
    }
  }

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "foto_cover" | "foto_acara"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(field === "foto_cover" ? "cover" : "acara");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && editing) {
        setEditing({ ...editing, [field]: data.url });
        setPesan({ text: "Foto berhasil diunggah!", tipe: "success" });
      } else {
        alert("Gagal mengunggah foto.");
      }
    } catch {
      alert("Terjadi kesalahan saat mengunggah foto.");
    } finally {
      setUploading(null);
    }
  };

  const handleUploadMusik = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    setUploading("musik");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        const defaultJudul = file.name.replace(/^\d+-/, "").replace(/\.[^.]+$/, "").replace(/-/g, " ");
        setEditing({
          ...editing,
          musik_url: data.url,
          musik_judul: editing.musik_judul || defaultJudul,
        });
        setPesan({ text: "Musik berhasil diunggah!", tipe: "success" });
      } else {
        setPesan({ text: data.error || "Gagal mengunggah musik.", tipe: "error" });
      }
    } catch {
      setPesan({ text: "Terjadi kesalahan saat mengunggah musik.", tipe: "error" });
    } finally {
      setUploading(null);
    }
  };

  if (!editing) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6 font-sans">
        <div className="text-center">
          <p className="text-gray-700 text-lg mb-2">
            {pesan ? pesan.text : "Memuat data admin undangan..."}
          </p>
          <p className="text-sm text-gray-500">Silakan periksa koneksi basis data PostgreSQL.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto grid gap-6">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Panel Undangan</h1>
            <p className="text-sm text-slate-500 mt-1">
              Edit semua informasi teks dan foto undangan. Perubahan langsung aktif.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/u/${editing.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm bg-slate-100 text-slate-700 px-4 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-200 font-medium"
            >
              Lihat Undangan ↗
            </a>
            <button
              onClick={() => router.push(`/admin/u/${slug}?${editing?.akses_token || token}`)}
              className="text-sm bg-sky-600 text-white px-4 py-2.5 rounded-lg hover:bg-sky-700 font-medium"
            >
              Kelola Tamu →
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="text-sm bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
            >
              {loading ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </div>

        {/* Notifikasi Pesan */}
        {pesan && (
          <div
            className={`p-4 rounded-xl border text-sm font-medium ${
              pesan.tipe === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {pesan.text}
          </div>
        )}

        {/* 1. Sampul & Identitas */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 grid gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-2 gap-2">
            <h2 className="text-lg font-bold text-slate-900">1. Sampul & Identitas Acara</h2>
            <span className="text-xs text-slate-500">Slug dan Token Tuan Rumah</span>
          </div>

          {/* Akses Khusus Tuan Rumah */}
          <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 p-4 rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base">🔑</span>
                  <label className="text-xs font-bold text-sky-950 uppercase tracking-wide">
                    Token Akses Tuan Rumah (Nama Pemesan)
                  </label>
                  <span className="text-[10px] bg-sky-200 text-sky-800 font-semibold px-2 py-0.5 rounded-full">
                    Akses Mandiri
                  </span>
                </div>
                <p className="text-xs text-sky-800 mt-1 leading-relaxed">
                  Beri token sesuai nama pemesan/tuan rumah (contoh: <strong>bumarpuah</strong>). Tuan rumah dapat langsung mengelola dan membagikan undangan tanpa perlu password.
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <div className="flex items-center border border-sky-300 rounded-lg bg-white px-2.5 py-1.5 shadow-sm">
                    <span className="text-xs text-slate-400 font-mono select-none">?</span>
                    <input
                      value={editing.akses_token || ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          akses_token: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
                        })
                      }
                      className="text-sm font-mono font-bold text-sky-900 bg-transparent outline-none w-36 ml-1"
                      placeholder="bumarpuah"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const hostToken = editing.akses_token || "bumarpuah";
                      const hostUrl = `${window.location.origin}/admin/u/${editing.slug}?${hostToken}`;
                      navigator.clipboard.writeText(hostUrl);
                      setPesan({
                        tipe: "success",
                        text: `Tautan Tuan Rumah berhasil disalin: ${hostUrl}`,
                      });
                    }}
                    className="text-xs bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2 rounded-lg font-medium shadow-sm transition-all"
                  >
                    📋 Salin Link Tuan Rumah
                  </button>

                  <a
                    href={`/admin/u/${editing.slug}?${editing.akses_token || "bumarpuah"}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-white hover:bg-sky-50 text-sky-800 border border-sky-300 px-3.5 py-2 rounded-lg font-medium shadow-sm"
                  >
                    ↗ Buka Panel Tuan Rumah
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Slug URL</label>
              <input
                value={editing.slug}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-sky-500 outline-none"
                placeholder="slug-url-undangan"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Judul Sampul</label>
              <input
                value={editing.judul_sampul || ""}
                onChange={(e) => setEditing({ ...editing, judul_sampul: e.target.value })}
                className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-sky-500 outline-none"
                placeholder="UNDANGAN"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Tanggal di Sampul</label>
              <input
                value={editing.tanggal_sampul || ""}
                onChange={(e) => setEditing({ ...editing, tanggal_sampul: e.target.value })}
                className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-sky-500 outline-none"
                placeholder="Rabu, 18 November 2026"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Nama Lengkap Anak</label>
              <input
                value={editing.nama_anak}
                onChange={(e) => setEditing({ ...editing, nama_anak: e.target.value })}
                className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-sky-500 outline-none font-semibold text-rose-700"
                placeholder="Nama Lengkap Anak"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Label Acara</label>
              <input
                value={editing.label_acara || ""}
                onChange={(e) => setEditing({ ...editing, label_acara: e.target.value })}
                className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-sky-500 outline-none"
                placeholder="Khitanan :"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Nama Orang Tua</label>
              <input
                value={editing.nama_orang_tua}
                onChange={(e) => setEditing({ ...editing, nama_orang_tua: e.target.value })}
                className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-sky-500 outline-none"
                placeholder="Bpk. Kastam - Ibu Sarinih"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Teks Keluarga Penutup</label>
              <input
                value={editing.sekeluarga || ""}
                onChange={(e) => setEditing({ ...editing, sekeluarga: e.target.value })}
                className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-sky-500 outline-none"
                placeholder="Sekeluarga"
              />
            </div>
          </div>
        </section>

        {/* 2. Foto Cover & Foto Acara */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 grid gap-4">
          <h2 className="text-lg font-bold text-slate-900 border-b pb-2">2. Foto Dokumentasi</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Foto Cover */}
            <div className="border border-slate-200 p-4 rounded-xl flex flex-col justify-between">
              <div>
                <label className="text-sm font-semibold text-slate-800">Foto Cover (Halaman Depan)</label>
                <p className="text-xs text-slate-500 mb-3">Tampil di bingkai lengkung bagian atas</p>
                {editing.foto_cover ? (
                  <img
                    src={editing.foto_cover}
                    alt="Foto Cover"
                    className="w-full h-44 object-cover rounded-lg border mb-3 bg-slate-100"
                  />
                ) : (
                  <div className="w-full h-44 flex items-center justify-center bg-slate-100 text-slate-400 text-xs rounded-lg border mb-3">
                    Belum ada foto cover (placeholder aktif)
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleUpload(e, "foto_cover")}
                  disabled={uploading !== null}
                  className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer"
                />
                {uploading === "cover" && <p className="text-xs text-sky-600">Mengunggah foto...</p>}
                <input
                  value={editing.foto_cover || ""}
                  onChange={(e) => setEditing({ ...editing, foto_cover: e.target.value })}
                  placeholder="Atau tempel URL gambar di sini"
                  className="border p-2 rounded-lg text-xs"
                />
              </div>
            </div>

            {/* Foto Acara */}
            <div className="border border-slate-200 p-4 rounded-xl flex flex-col justify-between">
              <div>
                <label className="text-sm font-semibold text-slate-800">Foto Acara (Foto Bulat)</label>
                <p className="text-xs text-slate-500 mb-3">Tampil di lingkaran bagian detail acara</p>
                <div className="flex justify-center mb-3">
                  {editing.foto_acara ? (
                    <img
                      src={editing.foto_acara}
                      alt="Foto Acara"
                      className="w-36 h-36 object-cover rounded-full border-4 border-slate-100 shadow-sm bg-slate-100"
                    />
                  ) : (
                    <div className="w-36 h-36 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 text-xs border text-center p-2">
                      Belum ada foto acara
                    </div>
                  )}
                </div>
              </div>
              <div className="grid gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleUpload(e, "foto_acara")}
                  disabled={uploading !== null}
                  className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer"
                />
                {uploading === "acara" && <p className="text-xs text-sky-600">Mengunggah foto...</p>}
                <input
                  value={editing.foto_acara || ""}
                  onChange={(e) => setEditing({ ...editing, foto_acara: e.target.value })}
                  placeholder="Atau tempel URL gambar di sini"
                  className="border p-2 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 3. Waktu, Tempat & Countdown */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 grid gap-4">
          <h2 className="text-lg font-bold text-slate-900 border-b pb-2">3. Waktu, Jadwal & Lokasi</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Tanggal Target Countdown</label>
              <input
                type="date"
                value={
                  editing.tanggal
                    ? typeof editing.tanggal === "string"
                      ? editing.tanggal.slice(0, 10)
                      : new Date(editing.tanggal).toISOString().slice(0, 10)
                    : ""
                }
                onChange={(e) => setEditing({ ...editing, tanggal: e.target.value })}
                className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Jam Target Countdown</label>
              <input
                type="time"
                value={editing.jam ? String(editing.jam).slice(0, 5) : ""}
                onChange={(e) => setEditing({ ...editing, jam: e.target.value })}
                className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Hiburan</label>
              <input
                value={editing.hiburan || ""}
                onChange={(e) => setEditing({ ...editing, hiburan: e.target.value })}
                className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-sky-500 outline-none"
                placeholder="Seni Reog Vikar Group"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Tempat & Bulan Singkat (Header Acara)</label>
              <input
                value={editing.tempat_singkat || ""}
                onChange={(e) => setEditing({ ...editing, tempat_singkat: e.target.value })}
                className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-sky-500 outline-none"
                placeholder="Rambatan Kulon, November 2026"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Teks Hari Acara</label>
              <input
                value={editing.hari_acara || ""}
                onChange={(e) => setEditing({ ...editing, hari_acara: e.target.value })}
                className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-sky-500 outline-none"
                placeholder="Rabu malam Kamis"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Teks Tanggal Acara</label>
              <input
                value={editing.tanggal_acara || ""}
                onChange={(e) => setEditing({ ...editing, tanggal_acara: e.target.value })}
                className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-sky-500 outline-none"
                placeholder="18 – 19 November 2026"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Teks Waktu Acara</label>
              <input
                value={editing.jam_acara || ""}
                onChange={(e) => setEditing({ ...editing, jam_acara: e.target.value })}
                className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-sky-500 outline-none"
                placeholder="Pkl. 08.00 Wib s/d Selesai"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Link Google Maps</label>
              <input
                value={editing.maps_url || ""}
                onChange={(e) => setEditing({ ...editing, maps_url: e.target.value })}
                className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-sky-500 outline-none"
                placeholder="https://maps.app.goo.gl/..."
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-600 uppercase">Alamat Lengkap Tempat Acara</label>
              <textarea
                value={editing.lokasi}
                onChange={(e) => setEditing({ ...editing, lokasi: e.target.value })}
                rows={2}
                className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-sky-500 outline-none"
                placeholder="Desa Rambatan Kulon (Bangkir) Rt. 07 Rw. 01 blok Kangkung Kec. Lohbener Kab. Indramayu"
              />
            </div>
          </div>
        </section>

        {/* 4. Turut Mengundang */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 grid gap-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h2 className="text-lg font-bold text-slate-900">4. Turut Mengundang</h2>
            <button
              onClick={() =>
                setEditing({
                  ...editing,
                  turut_mengundang: [...editing.turut_mengundang, ""],
                })
              }
              className="text-xs bg-sky-50 text-sky-700 hover:bg-sky-100 font-semibold px-3 py-1.5 rounded-lg border border-sky-200"
            >
              + Tambah Nama
            </button>
          </div>
          <div className="grid gap-2">
            {editing.turut_mengundang.map((item, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="text-xs font-semibold text-slate-400 w-6 text-right">{i + 1}.</span>
                <input
                  value={item}
                  onChange={(e) => {
                    const arr = [...editing.turut_mengundang];
                    arr[i] = e.target.value;
                    setEditing({ ...editing, turut_mengundang: arr });
                  }}
                  className="border p-2 rounded-lg text-sm flex-1 focus:ring-2 focus:ring-sky-500 outline-none"
                  placeholder="Nama kerabat yang turut mengundang"
                />
                <button
                  onClick={() =>
                    setEditing({
                      ...editing,
                      turut_mengundang: editing.turut_mengundang.filter((_, idx) => idx !== i),
                    })
                  }
                  className="text-xs text-rose-600 hover:text-rose-800 px-2 py-1"
                >
                  Hapus
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Kami yang Berbahagia & Alamat Keluarga */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 grid gap-4">
          <div className="flex justify-between items-center border-b pb-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900">5. Kami yang Berbahagia & Do&apos;a</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar nama tuan rumah / keluarga yang berbahagia. Data ini otomatis tampil seragam di akhir Section 2 (setelah Wassalamu&apos;alaikum) dan di Section 3 (Kami yang Berbahagia).
              </p>
            </div>
            <button
              onClick={() =>
                setEditing({
                  ...editing,
                  orang_berbahagia: [...editing.orang_berbahagia, { nama: "", keterangan: "" }],
                })
              }
              className="text-xs bg-sky-50 text-sky-700 hover:bg-sky-100 font-semibold px-3 py-1.5 rounded-lg border border-sky-200"
            >
              + Tambah Orang Berbahagia
            </button>
          </div>

          <div className="grid gap-3">
            {editing.orang_berbahagia.map((item, i) => (
              <div key={i} className="grid md:grid-cols-2 gap-2 border border-slate-200 p-3 rounded-lg relative">
                <div>
                  <label className="text-xs text-slate-500">Nama</label>
                  <input
                    value={item.nama}
                    onChange={(e) => {
                      const arr = [...editing.orang_berbahagia];
                      arr[i] = { ...arr[i], nama: e.target.value };
                      setEditing({ ...editing, orang_berbahagia: arr });
                    }}
                    className="w-full border p-2 rounded-lg text-sm font-semibold"
                    placeholder="Bpk. KASTAM"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Keterangan / Silsilah</label>
                  <textarea
                    value={item.keterangan}
                    onChange={(e) => {
                      const arr = [...editing.orang_berbahagia];
                      arr[i] = { ...arr[i], keterangan: e.target.value };
                      setEditing({ ...editing, orang_berbahagia: arr });
                    }}
                    rows={2}
                    className="w-full border p-2 rounded-lg text-sm"
                    placeholder="Bin Bpk. ... / Asal daerah"
                  />
                </div>
                <button
                  onClick={() =>
                    setEditing({
                      ...editing,
                      orang_berbahagia: editing.orang_berbahagia.filter((_, idx) => idx !== i),
                    })
                  }
                  className="text-xs text-rose-600 hover:text-rose-800 self-start md:col-span-2 text-right"
                >
                  Hapus Baris Ini
                </button>
              </div>
            ))}
          </div>

          <div className="grid gap-3 mt-2">
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Alamat Keluarga</label>
              <textarea
                value={editing.alamat_keluarga || ""}
                onChange={(e) => setEditing({ ...editing, alamat_keluarga: e.target.value })}
                rows={3}
                className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-sky-500 outline-none"
                placeholder="Desa Rambatan Kulon (Bangkir) Rt. 07 Rw. 01..."
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Ayat / Do&apos;a Kutipan</label>
              <textarea
                value={editing.ayat || ""}
                onChange={(e) => setEditing({ ...editing, ayat: e.target.value })}
                rows={3}
                className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-sky-500 outline-none italic"
                placeholder="Kutipan doa atau ayat..."
              />
            </div>
          </div>
        </section>

        {/* 6. Amplop Digital & Rekening */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 grid gap-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h2 className="text-lg font-bold text-slate-900">6. Rekening & E-Wallet (Amplop Digital)</h2>
            <button
              onClick={() =>
                setEditing({
                  ...editing,
                  rekening: [
                    ...editing.rekening,
                    { type: "bank", label: "", no: "", name: "" },
                  ],
                })
              }
              className="text-xs bg-sky-50 text-sky-700 hover:bg-sky-100 font-semibold px-3 py-1.5 rounded-lg border border-sky-200"
            >
              + Tambah Rekening
            </button>
          </div>

          <div className="grid gap-3">
            {editing.rekening.map((item, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-2 border border-slate-200 p-3 rounded-lg items-center">
                <div>
                  <label className="text-xs text-slate-500">Tipe</label>
                  <select
                    value={item.type}
                    onChange={(e) => {
                      const arr = [...editing.rekening];
                      arr[i] = { ...arr[i], type: e.target.value as "bank" | "wallet" };
                      setEditing({ ...editing, rekening: arr });
                    }}
                    className="w-full border p-2 rounded-lg text-sm bg-white"
                  >
                    <option value="bank">Bank</option>
                    <option value="wallet">E-Wallet</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Label (BCA / DANA / OVO)</label>
                  <input
                    value={item.label}
                    onChange={(e) => {
                      const arr = [...editing.rekening];
                      arr[i] = { ...arr[i], label: e.target.value };
                      setEditing({ ...editing, rekening: arr });
                    }}
                    className="w-full border p-2 rounded-lg text-sm"
                    placeholder="BCA / BRI / DANA"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Nomor Rekening / HP</label>
                  <input
                    value={item.no}
                    onChange={(e) => {
                      const arr = [...editing.rekening];
                      arr[i] = { ...arr[i], no: e.target.value };
                      setEditing({ ...editing, rekening: arr });
                    }}
                    className="w-full border p-2 rounded-lg text-sm font-mono"
                    placeholder="1234567890"
                  />
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500">Atas Nama Pemilik</label>
                    <input
                      value={item.name}
                      onChange={(e) => {
                        const arr = [...editing.rekening];
                        arr[i] = { ...arr[i], name: e.target.value };
                        setEditing({ ...editing, rekening: arr });
                      }}
                      className="w-full border p-2 rounded-lg text-sm"
                      placeholder="Nama Pemilik"
                    />
                  </div>
                  <button
                    onClick={() =>
                      setEditing({
                        ...editing,
                        rekening: editing.rekening.filter((_, idx) => idx !== i),
                      })
                    }
                    className="text-xs text-rose-600 hover:text-rose-800 p-2 mb-0.5"
                    title="Hapus Rekening"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 7. Footer Text */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 grid gap-3">
          <h2 className="text-lg font-bold text-slate-900 border-b pb-2">7. Teks Footer</h2>
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase">Ucapan Penutup Halaman</label>
            <input
              value={editing.footer_text || ""}
              onChange={(e) => setEditing({ ...editing, footer_text: e.target.value })}
              className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-sky-500 outline-none"
              placeholder="Terima kasih atas do'a restu Bapak/Ibu/Saudara/i"
            />
          </div>
        </section>

        {/* 8. Musik Latar */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 grid gap-4">
          <h2 className="text-lg font-bold text-slate-900 border-b pb-2">8. Musik Latar Undangan 🎵</h2>
          <p className="text-xs text-slate-500 -mt-2">
            Musik akan otomatis diputar (muted) saat tamu membuka undangan dan dapat diaktifkan dengan klik tombol.
            Format yang didukung: <strong>MP3, M4A, AAC, OGG</strong> (maks. 20 MB). Disarankan durasi 2–4 menit, lalu loop otomatis.
          </p>

          {/* Upload file audio */}
          <div className="border border-slate-200 p-4 rounded-xl grid gap-3">
            <label className="text-sm font-semibold text-slate-800">Upload File Musik dari Komputer</label>
            <input
              type="file"
              accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/aac,.mp3,.m4a,.ogg,.wav,.aac"
              onChange={handleUploadMusik}
              disabled={uploading !== null}
              className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
            />
            {uploading === "musik" && (
              <p className="text-xs text-purple-600 animate-pulse">⏳ Mengunggah musik... mohon tunggu.</p>
            )}
          </div>

          {/* Judul lagu */}
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase">Judul Lagu (ditampilkan di player)</label>
            <input
              value={editing.musik_judul || ""}
              onChange={(e) => setEditing({ ...editing, musik_judul: e.target.value })}
              className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-purple-500 outline-none"
              placeholder="Contoh: Sholawat Nabi — Maher Zain"
            />
          </div>

          {/* URL manual */}
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase">Atau Tempel URL Langsung (MP3/M4A/OGG)</label>
            <input
              value={editing.musik_url || ""}
              onChange={(e) => setEditing({ ...editing, musik_url: e.target.value })}
              className="w-full border p-2.5 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-purple-500 outline-none font-mono"
              placeholder="https://... atau /uploads/nama-file.mp3"
            />
          </div>

          {/* Pengaturan Potongan Durasi Lagu (Menit:Detik) */}
          <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-4 grid gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span>✂️</span> Potong Durasi Pemutaran (Mulai & Selesai)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Atur menit & detik bagian terbaik lagu (misal langsung masuk bagian <strong>Reff / Chorus</strong>). Tamu biasanya membaca undangan dalam waktu singkat.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">
                  Mulai dari (Menit : Detik)
                </label>
                <div className="flex gap-2 mt-1">
                  <input
                    value={editing.musik_start || ""}
                    onChange={(e) => setEditing({ ...editing, musik_start: e.target.value })}
                    className="flex-1 border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                    placeholder="00:30 (atau detik, misal 30)"
                  />
                  {editing.musik_url && (
                    <button
                      type="button"
                      onClick={() => setTimeFromCurrent("musik_start")}
                      title="Isi dengan posisi pemutar audio saat ini"
                      className="text-xs bg-white border border-purple-300 text-purple-700 hover:bg-purple-100 px-2.5 py-1 rounded-lg font-medium whitespace-nowrap shadow-sm"
                    >
                      ⏱ Set Saat Ini
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Contoh: <strong>00:45</strong> (mulai di detik ke-45)</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase">
                  Selesai pada (Menit : Detik)
                </label>
                <div className="flex gap-2 mt-1">
                  <input
                    value={editing.musik_end || ""}
                    onChange={(e) => setEditing({ ...editing, musik_end: e.target.value })}
                    className="flex-1 border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                    placeholder="02:15 (kosongkan jika sampai akhir)"
                  />
                  {editing.musik_url && (
                    <button
                      type="button"
                      onClick={() => setTimeFromCurrent("musik_end")}
                      title="Isi dengan posisi pemutar audio saat ini"
                      className="text-xs bg-white border border-purple-300 text-purple-700 hover:bg-purple-100 px-2.5 py-1 rounded-lg font-medium whitespace-nowrap shadow-sm"
                    >
                      ⏱ Set Saat Ini
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Bila tercapai, lagu otomatis berulang (loop) kembali ke menit mulai.</p>
              </div>
            </div>
          </div>

          {/* Preview player */}
          {editing.musik_url && (
            <div className="border border-purple-200 bg-purple-50 rounded-xl p-3.5 grid gap-2.5">
              <div className="flex justify-between items-center">
                <p className="text-xs font-semibold text-purple-700">▶ Preview Musik</p>
                {(editing.musik_start || editing.musik_end) && (
                  <button
                    type="button"
                    onClick={testTrimmedPlay}
                    className="text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold px-3 py-1 rounded-lg shadow-sm"
                  >
                    ▶ Uji Bagian Potongan
                  </button>
                )}
              </div>
              <audio ref={previewAudioRef} controls src={editing.musik_url} className="w-full h-10" />
              <div className="flex justify-between items-center text-xs text-slate-500">
                <p>Judul: <strong>{editing.musik_judul || "(belum diisi)"}</strong></p>
                {(editing.musik_start || editing.musik_end) && (
                  <p className="font-mono text-purple-700 font-medium">
                    Bagian aktif: {editing.musik_start || "00:00"} → {editing.musik_end || "Akhir lagu"}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditing({ ...editing, musik_url: "", musik_judul: "", musik_start: "", musik_end: "" })}
                className="text-xs text-rose-600 hover:text-rose-800 text-left w-fit"
              >
                🗑 Hapus musik
              </button>
            </div>
          )}

          {!editing.musik_url && (
            <div className="border border-dashed border-slate-300 rounded-xl p-4 text-center text-xs text-slate-400">
              Belum ada musik. Upload file atau tempel URL di atas.
            </div>
          )}
        </section>

        {/* Floating / Bottom Save Bar */}
        <div className="sticky bottom-4 bg-white p-4 rounded-xl shadow-lg border border-slate-200 flex justify-between items-center z-20">
          <div>
            <p className="text-sm font-medium text-slate-700">Periksa kembali data sebelum menyimpan.</p>
            <p className="text-xs text-slate-400">Data akan langsung terupdate di halaman publik.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 shadow-md transition-all text-sm"
          >
            {loading ? "Menyimpan Data..." : "Simpan Semua Perubahan"}
          </button>
        </div>
      </div>
    </main>
  );
}
