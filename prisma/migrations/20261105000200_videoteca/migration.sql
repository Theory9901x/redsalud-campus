-- Videoteca: videos de capacitación y quién los vio.
CREATE TABLE "VideoCapacitacion" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" TEXT,
    "mediaId" TEXT NOT NULL,
    "duracionSeg" INTEGER,
    "portada" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'LISTO',
    "publicado" BOOLEAN NOT NULL DEFAULT true,
    "creadoPor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VideoCapacitacion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VideoCapacitacion_mediaId_key" ON "VideoCapacitacion"("mediaId");
CREATE INDEX "VideoCapacitacion_publicado_createdAt_idx" ON "VideoCapacitacion"("publicado", "createdAt");
ALTER TABLE "VideoCapacitacion" ADD CONSTRAINT "VideoCapacitacion_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "VideoVista" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "segundos" INTEGER NOT NULL DEFAULT 0,
    "posicion" INTEGER NOT NULL DEFAULT 0,
    "completado" BOOLEAN NOT NULL DEFAULT false,
    "primeraVez" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaVez" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoVista_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VideoVista_videoId_userId_key" ON "VideoVista"("videoId", "userId");
CREATE INDEX "VideoVista_userId_idx" ON "VideoVista"("userId");
ALTER TABLE "VideoVista" ADD CONSTRAINT "VideoVista_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "VideoCapacitacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoVista" ADD CONSTRAINT "VideoVista_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
