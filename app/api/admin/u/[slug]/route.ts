import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  getUndanganBySlug,
  getUndanganByToken,
  getTamuByUndangan,
  tambahTamu,
  tambahBanyakTamu,
  updateTamu,
  updateTamuRsvpManual,
  hapusTamu,
  getRsvpByUndangan,
  hapusRsvp,
  updateUndanganLengkap,
} from "@/lib/undangan";

function extractToken(req: NextRequest): string {
  // 1. Cek parameter ?token=xxx
  const explicit = req.nextUrl.searchParams.get("token");
  if (explicit && explicit.trim()) return explicit.trim();

  // 2. Cek parameter bare query seperti ?bumarpuah
  for (const [key, value] of req.nextUrl.searchParams.entries()) {
    if (key && key !== "tamuId" && key !== "rsvpId" && key !== "to") {
      if (!value) return key.trim();
      if (key === "token") return value.trim();
    }
  }

  // 3. Cek Header Authorization
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  return "";
}

async function authorize(slug: string, token: string | null) {
  if (!token) return null;
  const clean = token.trim();

  // Admin Master Token (fallback dari .env.local atau default)
  const masterToken = process.env.NEXT_PUBLIC_FIXED_TOKEN || "tokencontoh12345";
  if (clean === masterToken) {
    return await getUndanganBySlug(slug);
  }

  // Token Tuan Rumah (misal: "bumarpuah")
  const u = await getUndanganByToken(clean);
  if (!u || u.slug !== slug) return null;
  return u;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const token = extractToken(req);
  const undangan = await authorize(slug, token);
  if (!undangan) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [tamu, rsvp] = await Promise.all([
    getTamuByUndangan(undangan.id),
    getRsvpByUndangan(undangan.id),
  ]);

  return NextResponse.json({ undangan, tamu, rsvp });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const token = extractToken(req);
  const undangan = await authorize(slug, token);
  if (!undangan) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // Tambah banyak tamu sekaligus (Bulk Import)
  if (Array.isArray(body.daftar_nama)) {
    const hasil = await tambahBanyakTamu(undangan.id, body.daftar_nama);
    return NextResponse.json({ ok: true, tamu: hasil });
  }

  // Tambah satu tamu
  if (body.nama && typeof body.nama === "string") {
    const tamu = await tambahTamu(undangan.id, body.nama);
    return NextResponse.json({ ok: true, tamu });
  }

  return NextResponse.json({ error: "Nama tamu tidak valid" }, { status: 400 });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const token = extractToken(req);
  const undangan = await authorize(slug, token);
  if (!undangan) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // Edit nama tamu & konfirmasi kehadiran manual
  if (body.tamuId) {
    if (body.nama) {
      await updateTamu(Number(body.tamuId), String(body.nama));
    }
    if (body.hadir !== undefined) {
      await updateTamuRsvpManual(Number(body.tamuId), body.hadir, body.ucapan);
    }
    return NextResponse.json({ ok: true });
  }

  // Edit data undangan lengkap
  const updated = await updateUndanganLengkap(undangan.id, body);
  revalidatePath(`/u/${slug}`);
  if (updated?.slug && updated.slug !== slug) {
    revalidatePath(`/u/${updated.slug}`);
  }
  revalidatePath("/admin");
  return NextResponse.json({ ok: true, undangan: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const token = extractToken(req);
  const undangan = await authorize(slug, token);
  if (!undangan) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tamuId = req.nextUrl.searchParams.get("tamuId");
  if (tamuId) {
    await hapusTamu(Number(tamuId));
  }

  const rsvpId = req.nextUrl.searchParams.get("rsvpId");
  if (rsvpId) {
    await hapusRsvp(Number(rsvpId));
  }

  return NextResponse.json({ ok: true });
}
