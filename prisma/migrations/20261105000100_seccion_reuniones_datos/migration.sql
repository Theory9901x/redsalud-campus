-- Nadie gana ni pierde acceso con el cambio: quien tenía restringidos los
-- planes de capacitación queda también sin reuniones...
UPDATE "User"
SET "restrictedAdminSections" = array_append("restrictedAdminSections", 'REUNIONES'::"AdminSection")
WHERE 'PLANES_CAPACITACION'::"AdminSection" = ANY("restrictedAdminSections")
  AND NOT ('REUNIONES'::"AdminSection" = ANY("restrictedAdminSections"));

-- ...salvo el usuario principal de SIAU, que ahora crea y gestiona reuniones.
UPDATE "User"
SET "restrictedAdminSections" = array_remove("restrictedAdminSections", 'REUNIONES'::"AdminSection")
WHERE "username" = 'siho';
