-- Rol de SEGUIMIENTO (Control Interno): ve el panel administrativo y sus
-- métricas, pero no puede crear, editar ni eliminar nada.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SEGUIMIENTO';
