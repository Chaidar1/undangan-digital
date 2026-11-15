import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_AUDIO = ["audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/aac", "audio/x-m4a"];
const MAX_IMAGE_MB = 10;
const MAX_AUDIO_MB = 20;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
    }

    const isAudio = ALLOWED_AUDIO.includes(file.type) || file.name.match(/\.(mp3|m4a|ogg|wav|aac)$/i);
    const isImage = ALLOWED_IMAGE.includes(file.type);
    const maxMB = isAudio ? MAX_AUDIO_MB : MAX_IMAGE_MB;

    if (!isAudio && !isImage) {
      return NextResponse.json({ error: "Tipe file tidak didukung. Gunakan gambar (JPG/PNG/WebP) atau audio (MP3/M4A/OGG)." }, { status: 400 });
    }
    if (file.size > maxMB * 1024 * 1024) {
      return NextResponse.json({ error: `Ukuran file terlalu besar. Maksimal ${maxMB} MB.` }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uniqueName = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const uploadDir = path.join(process.cwd(), "public/uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, uniqueName), buffer);

    return NextResponse.json({ url: `/uploads/${uniqueName}`, type: isAudio ? "audio" : "image" });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Gagal mengunggah file" }, { status: 500 });
  }
}