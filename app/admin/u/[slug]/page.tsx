"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Undangan = {
  id: number;
  slug: string;
  nama_anak: string;
  nama_orang_tua: string;
  tanggal: string;
  jam: string;
  lokasi: string;
  akses_token?: string;
  orang_berbahagia?: Array<{ nama: string; keterangan?: string }> | string;
  data_json?: {
    label_acara?: string;
    tanggal_acara?: string;
    jam_acara?: string;
    sekeluarga?: string;
    alamat_keluarga?: string;
  };
};

type Tamu = {
  id: number;
  nama: string;
  hadir?: boolean | null;
  ucapan?: string | null;
  rsvp_at?: string | null;
  created_at?: string;
};

type Rsvp = {
  id: number;
  nama: string;
  hadir: boolean;
  ucapan: string;
  created_at: string;
};

function getEffectiveToken(search: URLSearchParams): string {
  // 1. Cek parameter ?token=xxx
  const explicit = search.get("token");
  if (explicit && explicit.trim()) return explicit.trim();

  // 2. Cek format query langsung tanpa key name, seperti ?bumarpuah
  for (const [key, val] of search.entries()) {
    if (key && key !== "tamuId" && key !== "rsvpId" && key !== "to" && key !== "tid") {
      if (!val || val === "") return key.trim();
      if (key === "token") return val.trim();
    }
  }

  // 3. Fallback membaca dari window.location.search
  if (typeof window !== "undefined") {
    const raw = window.location.search.replace(/^\?/, "").trim();
    if (raw) {
      const first = raw.split("&")[0];
      if (first.includes("=")) {
        const [k, v] = first.split("=");
        if (k === "token") return decodeURIComponent(v).trim();
      } else {
        return decodeURIComponent(first).trim();
      }
    }
  }

  return "";
}

function KelolaContent() {
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();

  // Dapatkan token baik dari ?bumarpuah maupun ?token=bumarpuah
  const token = useMemo(() => getEffectiveToken(search), [search]);

  const [undangan, setUndangan] = useState<Undangan | null>(null);
  const [tamu, setTamu] = useState<Tamu[]>([]);
  const [rsvpList, setRsvpList] = useState<Rsvp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Input states
  const [namaTamuBaru, setNamaTamuBaru] = useState("");
  const [inputBanyakTamu, setInputBanyakTamu] = useState("");
  const [modeTambah, setModeTambah] = useState<"single" | "bulk">("single");
  const [prosesTambah, setProsesTambah] = useState(false);

  // Edit modal
  const [editingTamu, setEditingTamu] = useState<Tamu | null>(null);
  const [editNama, setEditNama] = useState("");
  const [editHadir, setEditHadir] = useState<boolean | null>(null);
  const [editUcapan, setEditUcapan] = useState("");

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKirim, setFilterKirim] = useState<
    "all" | "hadir" | "berhalangan" | "unconfirmed" | "sent" | "unsent"
  >("all");

  // Tab: Tamu vs RSVP
  const [activeTab, setActiveTab] = useState<"tamu" | "rsvp">("tamu");

  // Copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Status tracking tamu yang sudah dibagikan (disimpan di LocalStorage)
  const [sentMap, setSentMap] = useState<Record<number, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem(`undangan_sent_${params.slug}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleSent = (tamuId: number) => {
    setSentMap((prev) => {
      const updated = { ...prev, [tamuId]: !prev[tamuId] };
      try {
        localStorage.setItem(`undangan_sent_${params.slug}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const markAsSent = (tamuId: number) => {
    setSentMap((prev) => {
      const updated = { ...prev, [tamuId]: true };
      try {
        localStorage.setItem(`undangan_sent_${params.slug}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Muat data undangan, tamu, dan RSVP
  const muat = async () => {
    if (!params.slug) return;
    try {
      const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
      const res = await fetch(`/api/admin/u/${params.slug}${tokenParam}`);
      if (!res.ok) {
        setError(
          "Token akses tidak sesuai atau halaman undangan tidak ditemukan. Pastikan tautan menyertakan token seperti ?bumarpuah"
        );
        return;
      }
      const data = await res.json();
      setUndangan(data.undangan);
      setTamu(data.tamu || []);
      setRsvpList(data.rsvp || []);
      setError("");
    } catch (err) {
      setError("Gagal terhubung ke server: " + String(err));
    }
  };

  useEffect(() => {
    let ignore = false;
    async function muatAwal() {
      if (!params.slug) return;
      try {
        const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
        const res = await fetch(`/api/admin/u/${params.slug}${tokenParam}`);
        if (!res.ok) {
          if (!ignore) {
            setError(
              "Token akses tidak sesuai atau halaman undangan tidak ditemukan. Pastikan tautan menyertakan token seperti ?bumarpuah"
            );
            setLoading(false);
          }
          return;
        }
        const data = await res.json();
        if (!ignore) {
          setUndangan(data.undangan);
          setTamu(data.tamu || []);
          setRsvpList(data.rsvp || []);
          setError("");
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          setError("Gagal terhubung ke server: " + String(err));
          setLoading(false);
        }
      }
    }
    muatAwal();
    return () => {
      ignore = true;
    };
  }, [params.slug, token]);

  // Tambah 1 Tamu
  const tambahSatu = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const bersih = namaTamuBaru.trim();
    if (!bersih || !params.slug) return;

    setProsesTambah(true);
    try {
      const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
      const res = await fetch(`/api/admin/u/${params.slug}${tokenParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: bersih }),
      });
      if (res.ok) {
        setNamaTamuBaru("");
        await muat();
      }
    } finally {
      setProsesTambah(false);
    }
  };

  // Tambah Banyak Tamu Sekaligus (Bulk Import)
  const tambahBanyak = async () => {
    if (!inputBanyakTamu.trim() || !params.slug) return;
    const baris = inputBanyakTamu
      .split("\n")
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    if (baris.length === 0) return;

    setProsesTambah(true);
    try {
      const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
      const res = await fetch(`/api/admin/u/${params.slug}${tokenParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daftar_nama: baris }),
      });
      if (res.ok) {
        setInputBanyakTamu("");
        setModeTambah("single");
        await muat();
      }
    } finally {
      setProsesTambah(false);
    }
  };

  // Simpan perubahan nama tamu & kehadiran (Edit)
  const simpanEditNama = async () => {
    if (!editingTamu || !editNama.trim() || !params.slug) return;
    try {
      const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
      const res = await fetch(`/api/admin/u/${params.slug}${tokenParam}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tamuId: editingTamu.id,
          nama: editNama.trim(),
          hadir: editHadir,
          ucapan: editUcapan.trim(),
        }),
      });
      if (res.ok) {
        setEditingTamu(null);
        await muat();
      }
    } catch {}
  };

  // Hapus tamu
  const hapus = async (id: number, nama: string) => {
    if (!confirm(`Hapus tamu "${nama}" dari daftar undangan?`)) return;
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
    await fetch(`/api/admin/u/${params.slug}${tokenParam}&tamuId=${id}`, {
      method: "DELETE",
    });
    muat();
  };

  // Hapus RSVP (jika spam)
  const hapusRsvp = async (id: number) => {
    if (!confirm("Hapus pesan ucapan/konfirmasi kehadiran ini?")) return;
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
    await fetch(`/api/admin/u/${params.slug}${tokenParam}&rsvpId=${id}`, {
      method: "DELETE",
    });
    muat();
  };

  // Generator Tautan Undangan Khusus Tamu (dengan &tid= agar tercatat akurat)
  const getGuestLink = (tamuNama: string, tamuId?: number) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const namaSlug = tamuNama
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const tidParam = tamuId ? `&tid=${tamuId}` : "";
    return `${origin}/u/${params.slug}/${namaSlug || "tamu"}?to=${encodeURIComponent(tamuNama)}${tidParam}`;
  };

  // Generator Teks Pesan WhatsApp Siap Kirim
  const getWaMessage = (tamuNama: string, tamuId?: number) => {
    const link = getGuestLink(tamuNama, tamuId);
    const namaAnak = undangan?.nama_anak || "Zayyan Arkana Alfarizqi";
    const labelAcara = (undangan?.data_json?.label_acara || "Khitanan :")
      .replace(/:/g, "")
      .trim();
    const hariTgl = undangan?.data_json?.tanggal_acara || "18 – 19 November 2026";
    const jam =
      undangan?.data_json?.jam_acara ||
      (undangan?.jam ? `Pkl. ${String(undangan.jam).slice(0, 5)} WIB` : "Pkl. 08.00 WIB");
    const lokasi =
      undangan?.lokasi ||
      "Desa Rambatan Kulon (Bangkir) Rt. 07 Rw. 01 blok Kangkung Kec. Lohbener Kab. Indramayu";

    // Ekstrak nama tuan rumah / keluarga yang berbahagia secara terintegrasi dan berurutan dari data admin
    let daftarOrang: string[] = [];
    if (undangan?.orang_berbahagia) {
      let raw: unknown = undangan.orang_berbahagia;
      if (typeof raw === "string") {
        try {
          raw = JSON.parse(raw);
        } catch {
          raw = [];
        }
      }
      if (Array.isArray(raw) && raw.length > 0) {
        daftarOrang = raw
          .map((item) =>
            typeof item === "object" && item !== null && "nama" in item
              ? String(item.nama).trim()
              : String(item).trim()
          )
          .filter((n) => n.length > 0);
      }
    }

    // Jika orang_berbahagia kosong, gunakan fallback nama_orang_tua
    if (daftarOrang.length === 0) {
      if (undangan?.nama_orang_tua) {
        daftarOrang = [undangan.nama_orang_tua.trim()];
      } else {
        daftarOrang = ["Bpk. Kastam", "Ibu Sarinih"];
      }
    }

    const teksHormatKami = daftarOrang.map((nama) => `*${nama}*`).join("\n");

    return (
      `Kepada Yth.\n` +
      `Bapak/Ibu/Saudara/i: *${tamuNama}*\n` +
      `_________________________________\n\n` +
      `Assalamu'alaikum Warahmatullahi Wabarakatuh\n\n` +
      `Tanpa mengurangi rasa hormat, perkenankan kami mengundang Bapak/Ibu/Saudara/i untuk menghadiri acara syukuran ${labelAcara} putra kami:\n\n` +
      `👶 *${namaAnak}*\n\n` +
      `📅 *Waktu Acara:*\n${hariTgl}\n⏰ ${jam}\n\n` +
      `📍 *Lokasi:*\n${lokasi}\n\n` +
      `💌 *Tautan Undangan Digital:*\n` +
      `Silakan buka tautan undangan resmi untuk info lengkap, peta lokasi & do'a restu:\n` +
      `👉 ${link}\n\n` +
      `Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan do'a restu.\n\n` +
      `Wassalamu'alaikum Warahmatullahi Wabarakatuh\n\n` +
      `Hormat kami sekeluarga,\n` +
      `${teksHormatKami}`
    );
  };

  // Aksi Kirim WhatsApp
  const handleKirimWa = (t: Tamu) => {
    markAsSent(t.id);
    const msg = getWaMessage(t.nama, t.id);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  // Aksi Salin Pesan WA
  const handleSalinPesanWa = (t: Tamu) => {
    const msg = getWaMessage(t.nama, t.id);
    navigator.clipboard.writeText(msg);
    setCopiedKey(`wa-${t.id}`);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Aksi Salin Link Saja
  const handleSalinLink = (t: Tamu) => {
    const link = getGuestLink(t.nama, t.id);
    navigator.clipboard.writeText(link);
    setCopiedKey(`link-${t.id}`);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Filter daftar tamu berdasarkan pencarian & status kirim / kehadiran
  const filteredTamu = useMemo(() => {
    return tamu.filter((t) => {
      const cocokNama = t.nama.toLowerCase().includes(searchQuery.toLowerCase());
      const isSent = !!sentMap[t.id];
      if (filterKirim === "sent") return cocokNama && isSent;
      if (filterKirim === "unsent") return cocokNama && !isSent;
      if (filterKirim === "hadir") return cocokNama && t.hadir === true;
      if (filterKirim === "berhalangan") return cocokNama && t.hadir === false;
      if (filterKirim === "unconfirmed") return cocokNama && t.hadir !== true && t.hadir !== false;
      return cocokNama;
    });
  }, [tamu, searchQuery, filterKirim, sentMap]);

  // Hitung jumlah statistik
  const totalTamu = tamu.length;
  const sudahDikirimCount = Object.keys(sentMap).filter((id) => sentMap[Number(id)]).length;
  const belumDikirimCount = Math.max(0, totalTamu - sudahDikirimCount);
  const konfirmasiHadirCount = tamu.filter((t) => t.hadir === true).length;
  const konfirmasiBerhalanganCount = tamu.filter((t) => t.hadir === false).length;
  const belumKonfirmasiCount = tamu.filter((t) => t.hadir !== true && t.hadir !== false).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-sm w-full">
          <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="font-semibold text-slate-800 text-lg">Memuat Panel Tuan Rumah...</h2>
          <p className="text-sm text-slate-500 mt-1">Menyiapkan daftar tamu &amp; undangan</p>
        </div>
      </main>
    );
  }

  if (error || !undangan) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-md border border-rose-200 text-center max-w-md w-full">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-3">
            🔒
          </div>
          <h2 className="font-bold text-slate-900 text-xl">Akses Tidak Diizinkan</h2>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            {error || "Tautan yang Anda gunakan tidak memiliki token akses yang valid."}
          </p>
          <div className="mt-4 p-3 bg-slate-100 rounded-lg text-xs font-mono text-slate-700 text-left">
            Pastikan tautan dari admin menyertakan nama token, contoh:<br />
            <span className="text-sky-700 font-bold">/admin/u/{params.slug}?bumarpuah</span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full bg-sky-600 hover:bg-sky-700 text-white font-medium py-2.5 rounded-xl text-sm transition"
          >
            Muat Ulang Halaman
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto grid gap-6">

        {/* 1. TOP HEADER & IDENTITAS TUAN RUMAH */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
                PANEL TUAN RUMAH
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Token: <strong className="text-slate-700">{token || "bumarpuah"}</strong>
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
              Kelola Tamu Undangan
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Syukuran Khitanan <strong>{undangan.nama_anak}</strong> ({undangan.nama_orang_tua})
            </p>
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <a
              href={`/u/${undangan.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 md:flex-initial text-center text-sm bg-slate-100 text-slate-700 px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-200 font-medium transition"
            >
              Lihat Undangan Utama ↗
            </a>
          </div>
        </div>

        {/* 2. STATISTIK KARTU RINGKASAN */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Tamu</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalTamu}</div>
            <span className="text-xs text-slate-400">Nama terdaftar</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-sky-600 uppercase tracking-wide">Terkirim WA</span>
            <div className="text-2xl font-black text-sky-700 mt-1">{sudahDikirimCount}</div>
            <span className="text-xs text-sky-600 font-medium">dari {totalTamu} tamu</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-sm">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Konfirmasi Hadir</span>
            <div className="text-2xl font-black text-emerald-700 mt-1">{konfirmasiHadirCount}</div>
            <span className="text-xs text-emerald-600 font-medium">Bakal hadir ke acara</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/30 shadow-sm">
            <span className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Berhalangan</span>
            <div className="text-2xl font-black text-rose-700 mt-1">{konfirmasiBerhalanganCount}</div>
            <span className="text-xs text-rose-600 font-medium">Tidak dapat hadir</span>
          </div>
        </div>

        {/* 3. NAVIGASI TAB UTAMA (Daftar Tamu vs RSVP) */}
        <div className="flex border-b border-slate-200 gap-4">
          <button
            onClick={() => setActiveTab("tamu")}
            className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === "tamu"
                ? "border-sky-600 text-sky-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>👥 Daftar Tamu &amp; Link Undangan</span>
            <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full font-semibold">
              {tamu.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("rsvp")}
            className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === "rsvp"
                ? "border-sky-600 text-sky-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>💌 Semua Do&apos;a &amp; Buku Tamu</span>
            <span className="bg-sky-100 text-sky-800 text-xs px-2 py-0.5 rounded-full font-semibold">
              {rsvpList.length}
            </span>
          </button>
        </div>

        {/* 4. KONTEN TAB: KELOLA TAMU */}
        {activeTab === "tamu" && (
          <div className="grid gap-6">

            {/* Form Tambah Tamu (Single & Bulk) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                <div>
                  <h2 className="font-bold text-slate-900 text-base">Tambah Tamu Undangan</h2>
                  <p className="text-xs text-slate-500">
                    Masukkan nama tamu atau keluarga yang akan diundang
                  </p>
                </div>

                {/* Toggle Mode: 1 Tamu vs Banyak Tamu */}
                <div className="inline-flex bg-slate-100 p-1 rounded-xl text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setModeTambah("single")}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      modeTambah === "single"
                        ? "bg-white text-slate-900 shadow-sm font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    + Satu Tamu
                  </button>
                  <button
                    type="button"
                    onClick={() => setModeTambah("bulk")}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      modeTambah === "bulk"
                        ? "bg-white text-slate-900 shadow-sm font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    + Banyak Sekaligus (Import)
                  </button>
                </div>
              </div>

              {/* Mode Satu Tamu */}
              {modeTambah === "single" && (
                <form onSubmit={tambahSatu} className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={namaTamuBaru}
                    onChange={(e) => setNamaTamuBaru(e.target.value)}
                    placeholder="Contoh: Bpk. H. Ahmad & Keluarga atau dr. Rian"
                    className="border border-slate-300 p-3 rounded-xl flex-1 text-sm outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    disabled={prosesTambah}
                  />
                  <button
                    type="submit"
                    disabled={prosesTambah || !namaTamuBaru.trim()}
                    className="bg-sky-600 text-white px-6 py-3 rounded-xl hover:bg-sky-700 font-semibold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                  >
                    {prosesTambah ? "Menyimpan..." : "Tambahkan"}
                  </button>
                </form>
              )}

              {/* Mode Tambah Banyak (Bulk Import) */}
              {modeTambah === "bulk" && (
                <div className="grid gap-3">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tempelkan (paste) daftar nama dari WhatsApp atau Excel, <strong>1 nama per baris</strong>.
                  </p>
                  <textarea
                    rows={6}
                    value={inputBanyakTamu}
                    onChange={(e) => setInputBanyakTamu(e.target.value)}
                    placeholder="Bpk. H. Supardi & Keluarga&#10;Ibu Hj. Aminah&#10;Bpk. Rusdi - Ibu Titin&#10;Keluarga Besar Bani Kastam"
                    className="border border-slate-300 p-3 rounded-xl text-sm font-sans outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 w-full"
                    disabled={prosesTambah}
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">
                      Terdeteksi:{" "}
                      <strong>
                        {
                          inputBanyakTamu
                            .split("\n")
                            .filter((b) => b.trim().length > 0).length
                        }
                      </strong>{" "}
                      nama tamu
                    </span>
                    <button
                      type="button"
                      onClick={tambahBanyak}
                      disabled={
                        prosesTambah ||
                        inputBanyakTamu.split("\n").filter((b) => b.trim().length > 0).length === 0
                      }
                      className="bg-sky-600 text-white px-6 py-2.5 rounded-xl hover:bg-sky-700 font-semibold text-sm transition disabled:opacity-50 shadow-sm"
                    >
                      {prosesTambah ? "Menyimpan Semua..." : "Simpan Semua Tamu"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Daftar Tamu & Alat Pencarian / Filter */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-5">
                <div>
                  <h2 className="font-bold text-slate-900 text-base">Daftar Tamu Undangan</h2>
                  <p className="text-xs text-slate-500">
                    Kirim link via WhatsApp, salin pesan, serta pantau langsung status konfirmasi kehadiran dan ucapan do&apos;a tamu
                  </p>
                </div>

                {/* Filter Pill */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="inline-flex flex-wrap bg-slate-100 p-1 rounded-xl text-xs font-medium gap-1">
                    <button
                      type="button"
                      onClick={() => setFilterKirim("all")}
                      className={`px-3 py-1 rounded-lg transition ${
                        filterKirim === "all"
                          ? "bg-white text-slate-900 font-bold shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Semua ({tamu.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterKirim("hadir")}
                      className={`px-3 py-1 rounded-lg transition ${
                        filterKirim === "hadir"
                          ? "bg-white text-emerald-700 font-bold shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      🟢 Hadir ({konfirmasiHadirCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterKirim("berhalangan")}
                      className={`px-3 py-1 rounded-lg transition ${
                        filterKirim === "berhalangan"
                          ? "bg-white text-rose-700 font-bold shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      🔴 Berhalangan ({konfirmasiBerhalanganCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterKirim("unconfirmed")}
                      className={`px-3 py-1 rounded-lg transition ${
                        filterKirim === "unconfirmed"
                          ? "bg-white text-slate-700 font-bold shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      ⏳ Belum Konfirmasi ({belumKonfirmasiCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterKirim("unsent")}
                      className={`px-3 py-1 rounded-lg transition ${
                        filterKirim === "unsent"
                          ? "bg-white text-amber-700 font-bold shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Belum Kirim WA ({belumDikirimCount})
                    </button>
                  </div>
                </div>
              </div>

              {/* Input Pencarian */}
              <div className="mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Cari nama tamu..."
                  className="w-full border border-slate-200 bg-slate-50 px-4 py-2.5 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              {/* List Tamu */}
              {filteredTamu.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-sm font-medium text-slate-500">
                    {searchQuery
                      ? "Tidak ada tamu yang cocok dengan pencarian."
                      : "Belum ada tamu undangan yang ditambahkan."}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Gunakan formulir di atas untuk menambahkan tamu.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredTamu.map((t, index) => {
                    const guestLink = getGuestLink(t.nama, t.id);
                    const isSent = !!sentMap[t.id];

                    return (
                      <div
                        key={t.id}
                        className={`p-4 rounded-xl border transition-all ${
                          t.hadir === true
                            ? "bg-emerald-50/40 border-emerald-300"
                            : t.hadir === false
                            ? "bg-rose-50/40 border-rose-200"
                            : isSent
                            ? "bg-slate-50/70 border-slate-200"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">

                          {/* Info Nama, Badge Kehadiran, Link & Ucapan */}
                          <div className="flex-1 min-w-0 w-full">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono text-slate-400 select-none">
                                #{index + 1}
                              </span>
                              <h3 className="font-bold text-slate-900 text-base">
                                {t.nama}
                              </h3>

                              {/* BADGE KONFIRMASI KEHADIRAN (RSVP) */}
                              {t.hadir === true && (
                                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1 shadow-xs">
                                  <span>🟢</span> Hadir
                                </span>
                              )}
                              {t.hadir === false && (
                                <span className="bg-rose-100 text-rose-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border border-rose-300 flex items-center gap-1 shadow-xs">
                                  <span>🔴</span> Berhalangan
                                </span>
                              )}
                              {(t.hadir === null || t.hadir === undefined) && (
                                <span className="bg-slate-100 text-slate-500 text-[10px] font-medium px-2 py-0.5 rounded-full border border-slate-200">
                                  ⏳ Belum Konfirmasi
                                </span>
                              )}

                              {/* BADGE STATUS KIRIM WA */}
                              {isSent ? (
                                <span className="bg-sky-50 text-sky-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-sky-200">
                                  ✓ Terkirim WA
                                </span>
                              ) : (
                                <span className="bg-amber-50 text-amber-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-200">
                                  Belum Dikirim WA
                                </span>
                              )}
                            </div>

                            {/* Tautan Khusus Tamu */}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-slate-400 select-none">🔗</span>
                              <a
                                href={guestLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-sky-600 hover:underline truncate max-w-xs sm:max-w-md font-mono"
                              >
                                {guestLink}
                              </a>
                            </div>

                            {/* KOTAK UCAPAN & DO'A TAMU (TAMPIL LANGSUNG DI SETIAP BAR TAMU) */}
                            {t.ucapan && (
                              <div className="mt-3 bg-gradient-to-r from-amber-50 via-orange-50/50 to-amber-50 border border-amber-200 rounded-xl p-3 text-slate-800 shadow-xs">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                                    <span>💬</span> Ucapan &amp; Do&apos;a Tamu:
                                  </span>
                                  {t.rsvp_at && (
                                    <span className="text-[10px] text-amber-700 font-medium">
                                      {new Date(t.rsvp_at).toLocaleDateString("id-ID", {
                                        day: "numeric",
                                        month: "short",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs sm:text-sm text-slate-800 italic leading-relaxed font-serif">
                                  &ldquo;{t.ucapan}&rdquo;
                                </p>
                              </div>
                            )}
                          </div>

                          {/* DERETAN TOMBOL AKSI (BERIRINGAN DI SISI KANAN BARIS) */}
                          <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 flex-shrink-0">

                            {/* Tombol Kirim WhatsApp */}
                            <button
                              type="button"
                              onClick={() => handleKirimWa(t)}
                              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-2 rounded-lg transition flex items-center gap-1.5 shadow-sm"
                              title="Buka WhatsApp dengan pesan yang sudah terisi otomatis"
                            >
                              <span>🟢 Kirim WA</span>
                            </button>

                            {/* Tombol Salin Pesan WA */}
                            <button
                              type="button"
                              onClick={() => handleSalinPesanWa(t)}
                              className={`text-xs px-3 py-2 rounded-lg font-medium border transition ${
                                copiedKey === `wa-${t.id}`
                                  ? "bg-emerald-600 text-white border-emerald-600"
                                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                              }`}
                              title="Salin template ucapan lengkap beserta tautan"
                            >
                              {copiedKey === `wa-${t.id}` ? "Tersalin! ✓" : "📋 Salin Pesan"}
                            </button>

                            {/* Tombol Salin Link */}
                            <button
                              type="button"
                              onClick={() => handleSalinLink(t)}
                              className={`text-xs px-2.5 py-2 rounded-lg font-medium border transition ${
                                copiedKey === `link-${t.id}`
                                  ? "bg-emerald-600 text-white border-emerald-600"
                                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                              }`}
                              title="Salin URL undangan saja"
                            >
                              {copiedKey === `link-${t.id}` ? "✓" : "🔗 Salin Link"}
                            </button>

                            {/* Tombol Buka Preview */}
                            <a
                              href={guestLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2.5 py-2 rounded-lg border border-slate-200 transition"
                              title="Lihat tampilan undangan khusus nama tamu ini"
                            >
                              👁️ Buka
                            </a>

                            {/* Toggle Tandai Terkirim */}
                            <button
                              type="button"
                              onClick={() => toggleSent(t.id)}
                              className="text-xs text-slate-500 hover:text-slate-800 p-2 rounded-lg hover:bg-slate-100 transition"
                              title={isSent ? "Tandai belum dikirim" : "Tandai sudah dikirim"}
                            >
                              {isSent ? "↩ Batal" : "✓ Tandai"}
                            </button>

                            {/* Edit Nama & Kehadiran */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTamu(t);
                                setEditNama(t.nama);
                                setEditHadir(t.hadir ?? null);
                                setEditUcapan(t.ucapan || "");
                              }}
                              className="text-xs text-slate-500 hover:text-sky-600 p-2 rounded-lg hover:bg-slate-100 transition"
                              title="Ubah nama tamu atau catat konfirmasi kehadiran manual"
                            >
                              ✏️ Edit
                            </button>

                            {/* Hapus Tamu */}
                            <button
                              type="button"
                              onClick={() => hapus(t.id, t.nama)}
                              className="text-xs text-slate-400 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50 transition"
                              title="Hapus tamu"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Panduan Singkat untuk Tuan Rumah */}
            <div className="bg-sky-50 border border-sky-200 p-5 rounded-2xl">
              <h3 className="font-bold text-sky-950 text-sm mb-2 flex items-center gap-1.5">
                <span>💡</span> Tips Membagikan Undangan Digital
              </h3>
              <ul className="text-xs text-sky-900 grid gap-1.5 list-disc list-inside leading-relaxed">
                <li>
                  Gunakan tombol <strong>🟢 Kirim WA</strong> untuk langsung membuka aplikasi WhatsApp pada HP atau Laptop.
                </li>
                <li>
                  Nama tamu akan otomatis tercantum pada amplop sampul undangan depan dan formulir konfirmasi kehadiran.
                </li>
                <li>
                  Saat tamu mengisi konfirmasi kehadiran (Hadir/Berhalangan) dan do&apos;a restu, statusnya <strong>otomatis langsung muncul di bar baris tamu</strong> terkait.
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* 5. KONTEN TAB: SEMUA BUKU TAMU & RSVP */}
        {activeTab === "rsvp" && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-4">
              <div>
                <h2 className="font-bold text-slate-900 text-base">Semua Konfirmasi Kehadiran &amp; Do&apos;a Tamu</h2>
                <p className="text-xs text-slate-500">
                  Daftar seluruh tamu yang telah mengisi formulir kehadiran dari website undangan
                </p>
              </div>
              <button
                type="button"
                onClick={muat}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium transition"
              >
                🔄 Segarkan Data
              </button>
            </div>

            {rsvpList.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-sm font-medium text-slate-500">
                  Belum ada tamu yang mengirimkan konfirmasi kehadiran atau do&apos;a.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Pesan yang dikirimkan tamu melalui website akan otomatis muncul di sini dan di baris tamu.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {rsvpList.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900 text-sm">{r.nama}</strong>
                          {r.hadir ? (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                              ✓ Hadir
                            </span>
                          ) : (
                            <span className="bg-rose-100 text-rose-800 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-rose-200">
                              Berhalangan Hadir
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(r.created_at).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => hapusRsvp(r.id)}
                        className="text-xs text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                        title="Hapus ucapan"
                      >
                        🗑️
                      </button>
                    </div>

                    {r.ucapan && (
                      <div className="mt-2.5 p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed italic">
                        &ldquo;{r.ucapan}&rdquo;
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MODAL EDIT NAMA & KONFIRMASI KEHADIRAN TAMU */}
        {editingTamu && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
              <h3 className="font-bold text-slate-900 text-base mb-1">Edit Data Tamu &amp; Kehadiran</h3>
              <p className="text-xs text-slate-500 mb-4">
                Ubah ejaan nama tamu atau perbarui status kehadiran secara manual jika tamu memberi kabar via chat/telepon.
              </p>

              <div className="grid gap-3 mb-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase">Nama Tamu</label>
                  <input
                    type="text"
                    value={editNama}
                    onChange={(e) => setEditNama(e.target.value)}
                    className="w-full border border-slate-300 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500 mt-1"
                    placeholder="Nama Lengkap Tamu"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase">Status Kehadiran</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setEditHadir(true)}
                      className={`py-2 text-xs font-bold rounded-xl border transition ${
                        editHadir === true
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      🟢 Hadir
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditHadir(false)}
                      className={`py-2 text-xs font-bold rounded-xl border transition ${
                        editHadir === false
                          ? "bg-rose-600 text-white border-rose-600"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      🔴 Berhalangan
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditHadir(null)}
                      className={`py-2 text-xs font-semibold rounded-xl border transition ${
                        editHadir === null
                          ? "bg-slate-700 text-white border-slate-700"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      ⏳ Belum Tahu
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase">Catatan / Ucapan Do&apos;a</label>
                  <textarea
                    rows={3}
                    value={editUcapan}
                    onChange={(e) => setEditUcapan(e.target.value)}
                    className="w-full border border-slate-300 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500 mt-1"
                    placeholder="Ucapan dan do'a restu dari tamu..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTamu(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={simpanEditNama}
                  disabled={!editNama.trim()}
                  className="px-5 py-2 text-xs font-semibold bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition disabled:opacity-50"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

export default function KelolaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-sm text-slate-500 font-sans">
          Memuat Panel Tuan Rumah...
        </div>
      }
    >
      <KelolaContent />
    </Suspense>
  );
}
