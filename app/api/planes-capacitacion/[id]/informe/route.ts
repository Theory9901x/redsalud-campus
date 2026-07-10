import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getTrainingPlanDetail,
  getPlanAdherenceSummary,
  buildAdherenceBarData,
  buildActivityStatusCounts,
  getActivityAttendanceRoster,
  getActivityCompletionRoster,
} from "@/lib/training-plans";
import { getSurveysForPlan, buildSurveyResponseRate } from "@/lib/surveys";
import { renderTrainingPlanReportPdf, type TrainingPlanReportSections } from "@/lib/training-plan-report-pdf";
import { TRAINING_PLAN_STATUS_LABELS, TRAINING_ACTIVITY_TYPE_LABELS, TRAINING_ACTIVITY_STATUS_LABELS } from "@/components/training-plans/labels";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";

const DATE_FORMAT = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" });

const STATUS_CHART_COLORS = { DRAFT: "#5B7184", OPEN: "#3BB54A", CLOSED: "#0F2438" };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "TUTOR")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const plan = await getTrainingPlanDetail(id);
  if (!plan) {
    return NextResponse.json({ error: "Plan no encontrado." }, { status: 404 });
  }
  if (session.user.role !== "ADMIN" && plan.tutorId !== session.user.id) {
    return NextResponse.json({ error: "No autorizado: no eres el tutor responsable de este plan." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const secciones = new Set((searchParams.get("secciones") ?? "").split(",").filter(Boolean));

  const adherenceSummary = await getPlanAdherenceSummary({
    targetDepartment: plan.targetDepartment,
    activities: plan.activities,
  });
  const percentageByActivity = new Map(adherenceSummary.perActivity.map((a) => [a.activityId, a.percentage]));
  const statusCounts = buildActivityStatusCounts(plan.activities).map((s) => ({
    label: s.label,
    count: s.count,
    color: STATUS_CHART_COLORS[s.status],
  }));

  const sections: TrainingPlanReportSections = {};

  if (secciones.has("cronograma")) {
    sections.cronograma = plan.activities.map((activity) => ({
      title: activity.title,
      type: TRAINING_ACTIVITY_TYPE_LABELS[activity.type],
      course: activity.course?.title ?? null,
      dateLabel: `${DATE_FORMAT.format(activity.startDate)}${activity.endDate ? ` — ${DATE_FORMAT.format(activity.endDate)}` : ""}`,
      audience: COURSE_AUDIENCE_LABELS[activity.targetAudience],
      percentage: percentageByActivity.get(activity.id) ?? null,
      status: TRAINING_ACTIVITY_STATUS_LABELS[activity.status],
    }));
  }

  if (secciones.has("documentos")) {
    sections.documentos = plan.documents.map((doc) => ({
      fileName: doc.fileName,
      fileType: doc.fileType,
      dateLabel: DATE_FORMAT.format(doc.createdAt),
      uploader: doc.uploader.fullName,
    }));
  }

  if (secciones.has("encuestas")) {
    const surveys = await getSurveysForPlan(id);
    sections.encuestas = surveys.map((s) => ({
      title: s.title,
      scope: s.trainingActivity ? s.trainingActivity.title : "General del plan",
      responded: s._count.responses,
      target: s.targetCount,
      rate: s.targetCount > 0 ? Math.round((s._count.responses / s.targetCount) * 100) : 0,
    }));
  }

  if (secciones.has("noAdherentes")) {
    const closedActivities = plan.activities.filter((a) => a.status === "CLOSED");
    const rosters = await Promise.all(
      closedActivities.map(async (activity) => {
        const activityForRoster = {
          id: activity.id,
          targetAudience: activity.targetAudience,
          plan: { targetDepartment: plan.targetDepartment },
        };
        if (activity.courseId) {
          const roster = await getActivityCompletionRoster({ ...activityForRoster, courseId: activity.courseId });
          return roster.filter((u) => !u.completed).map((u) => ({ activityTitle: activity.title, fullName: u.fullName, documentNumber: u.documentNumber }));
        }
        const roster = await getActivityAttendanceRoster(activityForRoster);
        return roster.filter((u) => !u.attended).map((u) => ({ activityTitle: activity.title, fullName: u.fullName, documentNumber: u.documentNumber }));
      })
    );
    sections.noAdherentes = rosters.flat();
  }

  const surveysForRate = await getSurveysForPlan(id);

  const pdfBuffer = await renderTrainingPlanReportPdf({
    plan: {
      title: plan.title,
      year: plan.year,
      targetDepartment: plan.targetDepartment,
      tutorName: plan.tutor.fullName,
      status: TRAINING_PLAN_STATUS_LABELS[plan.status],
    },
    overallPercentage: adherenceSummary.overallPercentage,
    surveyResponseRate: buildSurveyResponseRate(surveysForRate),
    statusCounts,
    sections,
  });

  const fileName = `informe-${plan.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
