-- Audiencia por módulo: a quién se le muestra (grupo poblacional del
-- funcionario). AMBOS = todos; permite que en un mismo curso el personal
-- asistencial y el administrativo vean módulos distintos.
ALTER TABLE "CourseModule" ADD COLUMN "audience" "CourseAudience" NOT NULL DEFAULT 'AMBOS';
