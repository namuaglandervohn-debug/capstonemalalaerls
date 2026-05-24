import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Slider,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add,
  AddCircleOutline,
  DeleteOutline,
  Edit,
  EmojiEvents,
  Grade,
  Groups,
  Insights,
  Save,
  Sync,
  TaskAlt,
} from "@mui/icons-material";
import { supabase } from "../../lib/supabaseClient";
import { OUTLETS, POSITIONS } from "../../lib/constants";

const AVAILABLE_POSITIONS = POSITIONS.filter(position => position !== "Payroll Staff");
import { useAuth } from "../../context/AuthContext";

/* ── Types ─────────────────────────────────────────────────────────────── */
type EvaluationStatus = "Draft" | "Submitted" | "Reviewed" | "Approved" | "Returned" | "Cancelled";

interface CriterionDef {
  criteria_id: string;
  criteria_name: string;
  description: string | null;
  category: string | null;
  weight: number; // stored as percent, e.g. 25 = 25%
  max_score: number;
  is_active: boolean;
}

interface EmployeeRecord {
  employee_id: string;
  name: string;
  position: string;
  outlet: string;
  status: string;
}

interface EvaluationScoreRow {
  criteria_id: string;
  criteria_name: string;
  criteria_weight: number;
  max_score: number;
  raw_score: number;
  weighted_score: number;
}

interface EvaluationResult {
  evaluation_id: string;
  employee_id: string;
  employee_name: string;
  position: string;
  outlet: string;
  evaluation_period_start: string;
  evaluation_period_end: string;
  evaluation_period_label: string | null;
  evaluator_name: string | null;
  evaluator_role: string | null;
  total_raw_score: number;
  final_weighted_score: number;
  rating_label: string | null;
  status: EvaluationStatus;
  remarks: string | null;
  scores: Record<string, EvaluationScoreRow>;
}

interface DssResult {
  result_id: string;
  result_period_start: string;
  result_period_end: string;
  result_period_label: string | null;
  total_employees: number;
  highest_score: number;
  average_score: number;
  lowest_score: number;
  top_employee_id: string | null;
  top_employee_name: string | null;
  status: string;
  generated_at: string | null;
}

interface DssResultItem {
  result_id: string;
  evaluation_id: string;
  employee_id: string;
  employee_name: string;
  position: string;
  outlet: string;
  final_weighted_score: number;
  rating_label: string | null;
  rank_no: number;
  recommendation: string | null;
}

interface FormState {
  employee_id: string;
  employee_name: string;
  position: string;
  outlet: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  scores: Record<string, number>;
  remarks: string;
}

interface CriteriaEditorRow {
  criteria_id: string;
  criteria_name: string;
  description: string;
  category: string;
  weight: number;
  max_score: number;
  isNew?: boolean;
}

const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

const monthEnd = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
};

const fullName = (row: any) =>
  [row.first_name, row.middle_name, row.last_name, row.suffix].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

const formatPeriod = (r: Pick<EvaluationResult, "evaluation_period_start" | "evaluation_period_end" | "evaluation_period_label">) =>
  r.evaluation_period_label || `${r.evaluation_period_start} — ${r.evaluation_period_end}`;

const money = (n: number | null | undefined) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

function buildEmptyForm(criteria: CriterionDef[]): FormState {
  const scores: Record<string, number> = {};
  criteria.forEach((c) => {
    scores[c.criteria_id] = 85;
  });

  return {
    employee_id: "",
    employee_name: "",
    position: "",
    outlet: "",
    periodStart: monthStart(),
    periodEnd: monthEnd(),
    periodLabel: "",
    scores,
    remarks: "",
  };
}

function computePreviewScore(scores: Record<string, number>, criteria: CriterionDef[]): number {
  const totalWeight = criteria.reduce((sum, c) => sum + Number(c.weight || 0), 0);
  if (totalWeight <= 0) return 0;

  return criteria.reduce((sum, c) => {
    const raw = Number(scores[c.criteria_id] ?? 0);
    const max = Number(c.max_score || 100);
    const weighted = max > 0 ? (raw / max) * Number(c.weight || 0) : 0;
    return sum + weighted;
  }, 0);
}

function labelForScore(score: number) {
  if (score >= 90) return "Outstanding";
  if (score >= 85) return "Very Satisfactory";
  if (score >= 80) return "Satisfactory";
  if (score >= 75) return "Fair";
  return "Needs Improvement";
}

export default function PerformanceEvaluation() {
  const { user } = useAuth();
  const role = String((user as any)?.role || "").toLowerCase();
  const isHR = role === "hr_admin" || role.includes("hr") || role.includes("admin");
  const isSupervisor = role.includes("supervisor");
  const isGM = role === "general_manager" || role.includes("gm") || role.includes("general");
  const isEmployee = role.includes("employee");
  const currentUserName = String((user as any)?.name || (user as any)?.full_name || "Current User");
  const currentEmployeeId = String((user as any)?.employee_id || "");

  const [criteria, setCriteria] = useState<CriterionDef[]>([]);
  const [criteriaReady, setCriteriaReady] = useState<{ total_weight: number; is_ready: boolean; message: string } | null>(null);

  const [evaluations, setEvaluations] = useState<EvaluationResult[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [latestDss, setLatestDss] = useState<DssResult | null>(null);
  const [ranking, setRanking] = useState<DssResultItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [evalDialogOpen, setEvalDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => buildEmptyForm([]));

  const [criteriaDialogOpen, setCriteriaDialogOpen] = useState(false);
  const [criteriaDraft, setCriteriaDraft] = useState<CriteriaEditorRow[]>([]);

  const [dssDialogOpen, setDssDialogOpen] = useState(false);
  const [dssPeriodStart, setDssPeriodStart] = useState(monthStart());
  const [dssPeriodEnd, setDssPeriodEnd] = useState(monthEnd());
  const [dssPeriodLabel, setDssPeriodLabel] = useState("");

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "info" | "warning",
  });

  const showMessage = (message: string, severity: "success" | "error" | "info" | "warning" = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  /* ── Fetch helpers ─────────────────────────────────────────────────── */
  const fetchCriteria = async () => {
    const { data, error: err } = await supabase
      .from("evaluation_criteria")
      .select("criteria_id, criteria_name, description, category, weight, max_score, is_active")
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("criteria_name", { ascending: true });

    if (err) throw err;

    const active = (data || []).filter((c: any) => c.criteria_id && c.criteria_name) as CriterionDef[];
    setCriteria(active);
    setForm((prev) => {
      const nextScores = { ...prev.scores };
      active.forEach((c) => {
        if (typeof nextScores[c.criteria_id] !== "number") nextScores[c.criteria_id] = 85;
      });
      return { ...prev, scores: nextScores };
    });

    const { data: readyData } = await supabase.rpc("check_active_evaluation_criteria_weights");
    if (Array.isArray(readyData) && readyData.length > 0) {
      setCriteriaReady({
        total_weight: Number(readyData[0].total_weight || 0),
        is_ready: Boolean(readyData[0].is_ready),
        message: String(readyData[0].message || ""),
      });
    }
  };

  const fetchEmployees = async () => {
    setEmployeesLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("employees")
        .select("employee_id, first_name, middle_name, last_name, suffix, position, outlet, status")
        .order("last_name", { ascending: true });

      if (err) throw err;

      setEmployees(
        (data || []).map((e: any) => ({
          employee_id: e.employee_id,
          name: fullName(e) || e.employee_id,
          position: e.position || "",
          outlet: e.outlet || "",
          status: e.status || "Active",
        }))
      );
    } catch (err) {
      console.error(err);
      showMessage("Could not load employees.", "error");
    } finally {
      setEmployeesLoading(false);
    }
  };

  const fetchEvaluations = async () => {
    const { data: evalRows, error: evalErr } = await supabase
      .from("employee_evaluations")
      .select("*")
      .order("final_weighted_score", { ascending: false })
      .order("created_at", { ascending: false });

    if (evalErr) throw evalErr;

    const ids = (evalRows || []).map((r: any) => r.evaluation_id).filter(Boolean);
    let scoresByEvaluation: Record<string, Record<string, EvaluationScoreRow>> = {};

    if (ids.length > 0) {
      const { data: scoreRows, error: scoreErr } = await supabase
        .from("employee_evaluation_scores")
        .select("evaluation_id, criteria_id, criteria_name, criteria_weight, max_score, raw_score, weighted_score")
        .in("evaluation_id", ids);

      if (scoreErr) throw scoreErr;

      scoresByEvaluation = (scoreRows || []).reduce((acc: Record<string, Record<string, EvaluationScoreRow>>, row: any) => {
        if (!acc[row.evaluation_id]) acc[row.evaluation_id] = {};
        acc[row.evaluation_id][row.criteria_id] = {
          criteria_id: row.criteria_id,
          criteria_name: row.criteria_name,
          criteria_weight: Number(row.criteria_weight || 0),
          max_score: Number(row.max_score || 100),
          raw_score: Number(row.raw_score || 0),
          weighted_score: Number(row.weighted_score || 0),
        };
        return acc;
      }, {});
    }

    setEvaluations(
      (evalRows || []).map((row: any) => ({
        evaluation_id: row.evaluation_id,
        employee_id: row.employee_id,
        employee_name: row.employee_name || row.employee_id,
        position: row.position || "",
        outlet: row.outlet || "",
        evaluation_period_start: row.evaluation_period_start,
        evaluation_period_end: row.evaluation_period_end,
        evaluation_period_label: row.evaluation_period_label,
        evaluator_name: row.evaluator_name,
        evaluator_role: row.evaluator_role,
        total_raw_score: Number(row.total_raw_score || 0),
        final_weighted_score: Number(row.final_weighted_score || 0),
        rating_label: row.rating_label,
        status: row.status || "Draft",
        remarks: row.remarks,
        scores: scoresByEvaluation[row.evaluation_id] || {},
      }))
    );
  };

  const fetchLatestDss = async () => {
    const { data: dssRows, error: dssErr } = await supabase
      .from("dss_results")
      .select("*")
      .order("generated_at", { ascending: false })
      .limit(1);

    if (dssErr) throw dssErr;

    const current = (dssRows || [])[0] as DssResult | undefined;
    setLatestDss(current || null);

    if (!current?.result_id) {
      setRanking([]);
      return;
    }

    const { data: items, error: itemErr } = await supabase
      .from("dss_result_items")
      .select("*")
      .eq("result_id", current.result_id)
      .order("rank_no", { ascending: true });

    if (itemErr) throw itemErr;

    setRanking((items || []) as DssResultItem[]);
  };

  const refreshAll = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchCriteria(), fetchEmployees(), fetchEvaluations(), fetchLatestDss()]);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Could not load performance evaluation data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Derived values ────────────────────────────────────────────────── */
  const displayedEvaluations = useMemo(() => {
    if (isEmployee) {
      return evaluations.filter((e) => {
        if (currentEmployeeId) return e.employee_id === currentEmployeeId;
        return e.employee_name === currentUserName;
      });
    }

    if (isSupervisor) {
      return evaluations.filter((e) => e.evaluator_name === currentUserName);
    }

    return evaluations;
  }, [currentEmployeeId, currentUserName, evaluations, isEmployee, isSupervisor]);

  const previewScore = computePreviewScore(form.scores, criteria);
  const topDssItem = ranking.find((r) => (r.recommendation || "").includes("Employee of the Month")) || ranking[0] || null;

  /* ── Evaluation actions ────────────────────────────────────────────── */
  const openEvaluateForEmployee = (emp?: EmployeeRecord) => {
    setForm({
      ...buildEmptyForm(criteria),
      employee_id: emp?.employee_id || "",
      employee_name: emp?.name || "",
      position: emp?.position || "",
      outlet: emp?.outlet || "",
      periodLabel: `${new Date().toLocaleString("default", { month: "long" })} ${new Date().getFullYear()} Evaluation`,
    });
    setEvalDialogOpen(true);
  };

  const handleSubmitEvaluation = async () => {
    if (!form.employee_id) {
      showMessage("Please select an employee to evaluate.", "warning");
      return;
    }

    if (!form.periodStart || !form.periodEnd) {
      showMessage("Please select the evaluation period.", "warning");
      return;
    }

    if (!criteriaReady?.is_ready) {
      showMessage(criteriaReady?.message || "Criteria weights must total 100% before evaluation.", "error");
      return;
    }

    setSaving(true);
    try {
      const { data: evalId, error: templateErr } = await supabase.rpc("create_employee_evaluation_template", {
        p_employee_id: form.employee_id,
        p_period_start: form.periodStart,
        p_period_end: form.periodEnd,
        p_period_label: form.periodLabel || null,
        p_evaluator_user_id: null, // kept null to avoid FK errors if custom login user_id is not in user_accounts
        p_evaluator_name: currentUserName,
        p_evaluator_role: (user as any)?.role || "Supervisor",
      });

      if (templateErr) throw templateErr;

      const evaluationId = String(evalId);
      const updatePromises = criteria.map((c) =>
        supabase
          .from("employee_evaluation_scores")
          .update({ raw_score: Number(form.scores[c.criteria_id] ?? 0), updated_at: new Date().toISOString() })
          .eq("evaluation_id", evaluationId)
          .eq("criteria_id", c.criteria_id)
      );

      const updateResults = await Promise.all(updatePromises);
      const failedUpdate = updateResults.find((r) => r.error);
      if (failedUpdate?.error) throw failedUpdate.error;

      const { error: recalcErr } = await supabase.rpc("recalculate_employee_evaluation", {
        p_evaluation_id: evaluationId,
      });
      if (recalcErr) throw recalcErr;

      const { error: evalUpdateErr } = await supabase
        .from("employee_evaluations")
        .update({
          status: "Submitted",
          remarks: form.remarks || null,
          submitted_at: new Date().toISOString(),
          evaluator_name: currentUserName,
          evaluator_role: (user as any)?.role || "Supervisor",
        })
        .eq("evaluation_id", evaluationId);

      if (evalUpdateErr) throw evalUpdateErr;

      await supabase.rpc("create_system_log", {
        p_user_id: null,
        p_user_name: currentUserName,
        p_user_role: (user as any)?.role || null,
        p_action: "SUBMIT_EVALUATION",
        p_module: "Performance Evaluation",
        p_record_id: evaluationId,
        p_record_table: "employee_evaluations",
        p_description: `Submitted evaluation for ${form.employee_name || form.employee_id}.`,
        p_old_data: null,
        p_new_data: { employee_id: form.employee_id, final_preview_score: previewScore },
        p_ip_address: null,
        p_user_agent: navigator.userAgent,
      });

      setEvalDialogOpen(false);
      showMessage(`Evaluation submitted. Final score: ${previewScore.toFixed(2)}%.`, "success");
      await refreshAll();
    } catch (err: any) {
      console.error(err);
      showMessage(`Failed: ${err?.message || "Could not submit evaluation."}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (evaluationId: string) => {
    try {
      const { error: err } = await supabase
        .from("employee_evaluations")
        .update({
          status: "Approved",
          approved_at: new Date().toISOString(),
        })
        .eq("evaluation_id", evaluationId);

      if (err) throw err;

      await supabase.rpc("create_system_log", {
        p_user_id: null,
        p_user_name: currentUserName,
        p_user_role: (user as any)?.role || null,
        p_action: "APPROVE_EVALUATION",
        p_module: "Performance Evaluation",
        p_record_id: evaluationId,
        p_record_table: "employee_evaluations",
        p_description: "Approved employee evaluation.",
        p_old_data: null,
        p_new_data: { status: "Approved" },
        p_ip_address: null,
        p_user_agent: navigator.userAgent,
      });

      showMessage("Evaluation approved.", "success");
      await refreshAll();
    } catch (err: any) {
      console.error(err);
      showMessage(`Failed: ${err?.message || "Could not approve evaluation."}`, "error");
    }
  };

  const handleDelete = async (evaluationId: string) => {
    if (!window.confirm(`Delete evaluation ${evaluationId}? This cannot be undone.`)) return;

    try {
      const { error: err } = await supabase.from("employee_evaluations").delete().eq("evaluation_id", evaluationId);
      if (err) throw err;

      await supabase.rpc("create_system_log", {
        p_user_id: null,
        p_user_name: currentUserName,
        p_user_role: (user as any)?.role || null,
        p_action: "DELETE_EVALUATION",
        p_module: "Performance Evaluation",
        p_record_id: evaluationId,
        p_record_table: "employee_evaluations",
        p_description: "Deleted employee evaluation.",
        p_old_data: null,
        p_new_data: null,
        p_ip_address: null,
        p_user_agent: navigator.userAgent,
      });

      showMessage("Evaluation deleted.", "success");
      await refreshAll();
    } catch (err: any) {
      console.error(err);
      showMessage(`Failed: ${err?.message || "Could not delete evaluation."}`, "error");
    }
  };

  const handleGenerateDss = async () => {
    if (!dssPeriodStart || !dssPeriodEnd) {
      showMessage("Please select DSS period start and end dates.", "warning");
      return;
    }

    setSaving(true);
    try {
      const { data: resultId, error: err } = await supabase.rpc("generate_dss_results_from_evaluations", {
        p_period_start: dssPeriodStart,
        p_period_end: dssPeriodEnd,
        p_period_label: dssPeriodLabel || `${dssPeriodStart} — ${dssPeriodEnd}`,
        p_generated_by_user_id: null,
      });

      if (err) throw err;

      await supabase.rpc("create_system_log", {
        p_user_id: null,
        p_user_name: currentUserName,
        p_user_role: (user as any)?.role || null,
        p_action: "GENERATE_DSS_RANKING",
        p_module: "Performance Evaluation DSS",
        p_record_id: String(resultId),
        p_record_table: "dss_results",
        p_description: `Generated DSS ranking for ${dssPeriodStart} to ${dssPeriodEnd}.`,
        p_old_data: null,
        p_new_data: { result_id: resultId },
        p_ip_address: null,
        p_user_agent: navigator.userAgent,
      });

      setDssDialogOpen(false);
      showMessage("DSS ranking generated successfully.", "success");
      await refreshAll();
    } catch (err: any) {
      console.error(err);
      showMessage(`Failed: ${err?.message || "Could not generate DSS ranking."}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkEOTM = async (item: DssResultItem) => {
    try {
      const { error: err } = await supabase
        .from("dss_result_items")
        .update({ recommendation: "Employee of the Month", remarks: "Manually marked by management." })
        .eq("result_id", item.result_id)
        .eq("evaluation_id", item.evaluation_id);

      if (err) throw err;

      await supabase.rpc("create_system_log", {
        p_user_id: null,
        p_user_name: currentUserName,
        p_user_role: (user as any)?.role || null,
        p_action: "MARK_EMPLOYEE_OF_THE_MONTH",
        p_module: "Performance Evaluation DSS",
        p_record_id: item.evaluation_id,
        p_record_table: "dss_result_items",
        p_description: `${item.employee_name} was marked as Employee of the Month.`,
        p_old_data: null,
        p_new_data: { recommendation: "Employee of the Month" },
        p_ip_address: null,
        p_user_agent: navigator.userAgent,
      });

      showMessage("Employee of the Month saved.", "success");
      await refreshAll();
    } catch (err: any) {
      console.error(err);
      showMessage(`Failed: ${err?.message || "Could not mark Employee of the Month."}`, "error");
    }
  };

  /* ── Criteria actions ──────────────────────────────────────────────── */
  const openCriteriaDialog = () => {
    setCriteriaDraft(
      criteria.map((c) => ({
        criteria_id: c.criteria_id,
        criteria_name: c.criteria_name,
        description: c.description || "",
        category: c.category || "",
        weight: Number(c.weight || 0),
        max_score: Number(c.max_score || 100),
      }))
    );
    setCriteriaDialogOpen(true);
  };

  const addNewCriterion = () => {
    setCriteriaDraft((prev) => [
      ...prev,
      {
        criteria_id: `NEW-${Date.now()}`,
        criteria_name: "New Criterion",
        description: "Describe this criterion.",
        category: "Custom",
        weight: 0,
        max_score: 100,
        isNew: true,
      },
    ]);
  };

  const removeCriterion = (idx: number) => {
    setCriteriaDraft((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveCriteria = async () => {
    const total = criteriaDraft.reduce((sum, c) => sum + Number(c.weight || 0), 0);
    if (Math.round(total * 100) / 100 !== 100) {
      showMessage(`Criteria weights must total exactly 100%. Current total: ${total}%.`, "error");
      return;
    }

    setSaving(true);
    try {
      const keptExistingIds = criteriaDraft.filter((c) => !c.isNew).map((c) => c.criteria_id);
      const activeExistingIds = criteria.map((c) => c.criteria_id);
      const toDeactivate = activeExistingIds.filter((id) => !keptExistingIds.includes(id));

      if (toDeactivate.length > 0) {
        const { error: deactivateErr } = await supabase
          .from("evaluation_criteria")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in("criteria_id", toDeactivate);

        if (deactivateErr) throw deactivateErr;
      }

      for (const row of criteriaDraft) {
        const payload = {
          criteria_name: row.criteria_name,
          description: row.description || null,
          category: row.category || null,
          weight: Number(row.weight || 0),
          max_score: Number(row.max_score || 100),
          is_active: true,
          updated_at: new Date().toISOString(),
        };

        if (row.isNew) {
          const { error: insertErr } = await supabase.from("evaluation_criteria").insert(payload);
          if (insertErr) throw insertErr;
        } else {
          const { error: updateErr } = await supabase
            .from("evaluation_criteria")
            .update(payload)
            .eq("criteria_id", row.criteria_id);

          if (updateErr) throw updateErr;
        }
      }

      await supabase.rpc("create_system_log", {
        p_user_id: null,
        p_user_name: currentUserName,
        p_user_role: (user as any)?.role || null,
        p_action: "UPDATE_DSS_CRITERIA",
        p_module: "Performance Evaluation DSS",
        p_record_id: null,
        p_record_table: "evaluation_criteria",
        p_description: "Updated DSS evaluation criteria and weights.",
        p_old_data: null,
        p_new_data: { total_weight: total, criteria_count: criteriaDraft.length },
        p_ip_address: null,
        p_user_agent: navigator.userAgent,
      });

      setCriteriaDialogOpen(false);
      showMessage("DSS criteria updated successfully.", "success");
      await refreshAll();
    } catch (err: any) {
      console.error(err);
      showMessage(`Failed: ${err?.message || "Could not save criteria."}`, "error");
    } finally {
      setSaving(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════════ */
  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, flexWrap: "wrap", gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom fontWeight="bold" sx={{ fontSize: { xs: "1.35rem", sm: "1.75rem", md: "2.125rem" } }}>
            Performance Evaluation with DSS
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Supabase-connected evaluation criteria, scoring, ranking, and Employee of the Month decision support.
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Tooltip title="Refresh">
            <span>
              <IconButton onClick={refreshAll} disabled={loading}>
                <Sync />
              </IconButton>
            </span>
          </Tooltip>

          {isHR && (
            <Button variant="outlined" startIcon={<Edit />} onClick={openCriteriaDialog}>
              Manage Criteria
            </Button>
          )}

          {(isSupervisor || isHR) && (
            <Button variant="contained" startIcon={<AddCircleOutline />} onClick={() => openEvaluateForEmployee()}>
              New Evaluation
            </Button>
          )}

          {(isHR || isGM) && (
            <Button variant="contained" color="success" startIcon={<Insights />} onClick={() => setDssDialogOpen(true)}>
              Generate DSS
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={refreshAll}>Retry</Button>}>
          {error}
        </Alert>
      )}

      {criteriaReady && (
        <Alert severity={criteriaReady.is_ready ? "success" : "error"} sx={{ mb: 2 }}>
          DSS Criteria Weight Check: <strong>{money(criteriaReady.total_weight)}%</strong> — {criteriaReady.message}
        </Alert>
      )}

      {/* DSS Formula Banner */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: "#f0f7f0" }}>
        <Typography variant="subtitle2" fontWeight={700} color="primary.dark" gutterBottom>
          DSS Weighted Scoring Formula:
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Final Score ={" "}
          {criteria.length > 0
            ? criteria.map((c) => `(${c.criteria_name} × ${Number(c.weight || 0)}%)`).join(" + ")
            : "No active criteria found."}
        </Typography>
      </Paper>

      {/* Stat cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card elevation={2}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">Total Evaluations</Typography>
                  <Typography variant="h5" fontWeight="bold">{displayedEvaluations.length}</Typography>
                </Box>
                <TaskAlt color="success" sx={{ fontSize: 36 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card elevation={2}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">Submitted / Pending</Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {evaluations.filter((r) => r.status === "Submitted" || r.status === "Reviewed").length}
                  </Typography>
                </Box>
                <Insights color="warning" sx={{ fontSize: 36 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card elevation={2}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">Latest DSS Average</Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {latestDss ? `${Number(latestDss.average_score || 0).toFixed(2)}%` : "—"}
                  </Typography>
                </Box>
                <Grade color="primary" sx={{ fontSize: 36 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card elevation={2} sx={{ bgcolor: "warning.main", color: "white" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>🏆 Employee of the Month</Typography>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {topDssItem ? `${topDssItem.employee_name} — ${Number(topDssItem.final_weighted_score || 0).toFixed(2)}%` : "Not yet generated"}
                  </Typography>
                </Box>
                <EmojiEvents sx={{ fontSize: 44 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Supervisor employee list */}
      {isSupervisor && (
        <Paper sx={{ mb: 4 }}>
          <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 1 }}>
            <Groups color="primary" />
            <Typography variant="h6" fontWeight={700}>Employee List — Select an Employee to Evaluate</Typography>
          </Box>

          <TableContainer sx={{ overflowX: "auto" }}>
            {employeesLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 5, gap: 2 }}>
                <CircularProgress size={24} />
                <Typography color="text.secondary">Loading employees…</Typography>
              </Box>
            ) : (
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: "primary.main" }}>
                    {["Employee ID", "Name", "Position", "Outlet", "Status", "Action"].map((h) => (
                      <TableCell key={h} sx={{ color: "white", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {employees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 5, color: "text.secondary" }}>
                        No employees found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    employees.map((emp) => (
                      <TableRow key={emp.employee_id} hover>
                        <TableCell><Chip label={emp.employee_id} size="small" variant="outlined" /></TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{emp.name}</TableCell>
                        <TableCell>{emp.position}</TableCell>
                        <TableCell>{emp.outlet}</TableCell>
                        <TableCell>
                          <Chip label={emp.status} size="small" color={emp.status === "Active" ? "success" : "default"} />
                        </TableCell>
                        <TableCell>
                          <Button size="small" variant="outlined" onClick={() => openEvaluateForEmployee(emp)}>
                            Evaluate
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </TableContainer>
        </Paper>
      )}

      {/* Evaluation Results Table */}
      <TableContainer component={Paper} sx={{ overflowX: "auto", mb: 4 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6, gap: 2 }}>
            <CircularProgress size={28} />
            <Typography color="text.secondary">Loading evaluations…</Typography>
          </Box>
        ) : (
          <Table sx={{ minWidth: 1200 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: "primary.main" }}>
                {[
                  "Rank",
                  "Employee",
                  "Position",
                  "Outlet",
                  "Period",
                  ...criteria.map((c) => `${c.criteria_name} (${Number(c.weight || 0)}%)`),
                  "Final Score",
                  "Rating",
                  "Status",
                  ...(isHR || isGM ? ["Actions"] : []),
                ].map((h) => (
                  <TableCell key={h} sx={{ color: "white", fontWeight: 700, whiteSpace: "nowrap", fontSize: "0.78rem" }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {displayedEvaluations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10 + criteria.length} align="center" sx={{ py: 5, color: "text.secondary" }}>
                    No evaluations found.
                  </TableCell>
                </TableRow>
              ) : (
                displayedEvaluations.map((r, i) => (
                  <TableRow key={r.evaluation_id} hover sx={{ bgcolor: i === 0 ? "#f0f7f0" : "inherit" }}>
                    <TableCell>
                      <Chip label={`#${i + 1}`} color={i === 0 ? "success" : "default"} size="small" />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{r.employee_name}</TableCell>
                    <TableCell>{r.position}</TableCell>
                    <TableCell>{r.outlet}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatPeriod(r)}</TableCell>
                    {criteria.map((c) => {
                      const s = r.scores[c.criteria_id];
                      return (
                        <TableCell key={`${r.evaluation_id}-${c.criteria_id}`} align="center" sx={{ whiteSpace: "nowrap" }}>
                          {s ? `${Number(s.raw_score || 0).toFixed(0)}%` : "—"}
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <Typography fontWeight="bold" color="primary.main" sx={{ whiteSpace: "nowrap" }}>
                        {Number(r.final_weighted_score || 0).toFixed(2)}%
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={r.rating_label || labelForScore(Number(r.final_weighted_score || 0))}
                        size="small"
                        color={Number(r.final_weighted_score || 0) >= 85 ? "success" : Number(r.final_weighted_score || 0) >= 75 ? "warning" : "default"}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={isEmployee && r.status === "Submitted" ? "Under Review" : r.status}
                        size="small"
                        color={r.status === "Approved" ? "success" : r.status === "Submitted" || r.status === "Reviewed" ? "warning" : "default"}
                      />
                    </TableCell>
                    {(isHR || isGM) && (
                      <TableCell>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, alignItems: "flex-start" }}>
                          {(r.status === "Submitted" || r.status === "Reviewed") && (
                            <Chip
                              label="Approve"
                              size="small"
                              clickable
                              variant="outlined"
                              color="success"
                              sx={{ minWidth: 110 }}
                              onClick={() => handleApprove(r.evaluation_id)}
                            />
                          )}
                          <Chip
                            label="Delete"
                            size="small"
                            clickable
                            variant="outlined"
                            color="error"
                            sx={{ minWidth: 110 }}
                            onClick={() => handleDelete(r.evaluation_id)}
                          />
                        </Box>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* DSS Ranking */}
      {(isHR || isGM || ranking.length > 0) && (
        <Paper sx={{ mb: 4 }}>
          <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
            <Box>
              <Typography variant="h6" fontWeight={700}>DSS Ranking Results</Typography>
              <Typography variant="caption" color="text.secondary">
                {latestDss
                  ? `${latestDss.result_period_label || "Latest DSS Result"} • ${latestDss.result_period_start} to ${latestDss.result_period_end}`
                  : "Generate a DSS ranking to view employee recommendations."}
              </Typography>
            </Box>
            {(isHR || isGM) && (
              <Button size="small" variant="outlined" startIcon={<Insights />} onClick={() => setDssDialogOpen(true)}>
                Generate Ranking
              </Button>
            )}
          </Box>

          <TableContainer sx={{ overflowX: "auto" }}>
            <Table sx={{ minWidth: 900 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: "grey.100" }}>
                  {["Rank", "Employee", "Position", "Outlet", "Score", "Rating", "Recommendation", ...(isGM ? ["Action"] : [])].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {ranking.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 5, color: "text.secondary" }}>
                      No DSS ranking generated yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  ranking.map((item) => (
                    <TableRow key={`${item.result_id}-${item.evaluation_id}`} hover sx={{ bgcolor: item.rank_no === 1 ? "#fff8e1" : "inherit" }}>
                      <TableCell>
                        <Chip
                          label={item.rank_no === 1 ? "🏆 #1" : `#${item.rank_no}`}
                          color={item.rank_no === 1 ? "warning" : "default"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{item.employee_name}</TableCell>
                      <TableCell>{item.position}</TableCell>
                      <TableCell>{item.outlet}</TableCell>
                      <TableCell>
                        <Typography fontWeight="bold" color="primary.main">{Number(item.final_weighted_score || 0).toFixed(2)}%</Typography>
                      </TableCell>
                      <TableCell>{item.rating_label || "—"}</TableCell>
                      <TableCell>
                        <Chip
                          label={item.recommendation || "—"}
                          size="small"
                          color={(item.recommendation || "").includes("Employee of the Month") ? "warning" : item.rank_no === 1 ? "success" : "default"}
                        />
                      </TableCell>
                      {isGM && (
                        <TableCell>
                          <Button size="small" variant="outlined" color="warning" onClick={() => handleMarkEOTM(item)}>
                            Mark EOTM
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Evaluation Dialog */}
      <Dialog open={evalDialogOpen} onClose={() => setEvalDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle fontWeight={700}>Employee Performance Evaluation</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                select
                label="Employee"
                value={form.employee_id}
                onChange={(e) => {
                  const selected = employees.find((emp) => emp.employee_id === e.target.value);
                  setForm({
                    ...form,
                    employee_id: selected?.employee_id || "",
                    employee_name: selected?.name || "",
                    position: selected?.position || "",
                    outlet: selected?.outlet || "",
                  });
                }}
                InputLabelProps={{ shrink: true }}
              >
                <MenuItem value="">Select employee…</MenuItem>
                {employees.map((emp) => (
                  <MenuItem key={emp.employee_id} value={emp.employee_id}>
                    {emp.employee_id} — {emp.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Employee Name" value={form.employee_name} disabled InputLabelProps={{ shrink: true }} />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                select
                label="Position"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                InputLabelProps={{ shrink: true }}
              >
                <MenuItem value="">Select position…</MenuItem>
                {AVAILABLE_POSITIONS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                select
                label="Outlet"
                value={form.outlet}
                onChange={(e) => setForm({ ...form, outlet: e.target.value })}
                InputLabelProps={{ shrink: true }}
              >
                <MenuItem value="">Select outlet…</MenuItem>
                {OUTLETS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Period Start"
                type="date"
                value={form.periodStart}
                onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Period End"
                type="date"
                value={form.periodEnd}
                onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Period Label"
                value={form.periodLabel}
                onChange={(e) => setForm({ ...form, periodLabel: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              DSS CRITERIA SCORES
            </Typography>
          </Divider>

          <Grid container spacing={1.5}>
            {criteria.map((c) => (
              <Grid key={c.criteria_id} size={{ xs: 12, md: 6 }}>
                <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{c.criteria_name}</Typography>
                      <Typography variant="caption" color="text.secondary">Weight: {Number(c.weight || 0)}%</Typography>
                    </Box>
                    <Typography variant="h6" fontWeight="bold" color="primary">
                      {form.scores[c.criteria_id] ?? 0}%
                    </Typography>
                  </Box>
                  <Slider
                    value={form.scores[c.criteria_id] ?? 0}
                    onChange={(_, v) => setForm({ ...form, scores: { ...form.scores, [c.criteria_id]: v as number } })}
                    valueLabelDisplay="auto"
                    min={0}
                    max={Number(c.max_score || 100)}
                    size="small"
                    sx={{ color: (form.scores[c.criteria_id] ?? 0) >= 75 ? "success.main" : "primary.main" }}
                  />
                  <Typography variant="caption" color="text.secondary">{c.description}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          <TextField
            fullWidth
            label="Remarks"
            multiline
            rows={3}
            value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            sx={{ mt: 3 }}
          />

          <Paper
            sx={{
              p: 2.5,
              mt: 3,
              bgcolor: previewScore >= 90 ? "warning.light" : previewScore >= 75 ? "success.light" : "primary.light",
              borderRadius: 2,
            }}
          >
            <Typography variant="h5" color="white" fontWeight="bold">
              Projected Final Score: {previewScore.toFixed(2)}% {previewScore >= 90 && "🏆"}
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.9)", mt: 0.5 }}>
              {labelForScore(previewScore)}
            </Typography>
          </Paper>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEvalDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmitEvaluation}
            disabled={saving || !form.employee_id || criteria.length === 0}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {saving ? "Submitting…" : "Submit Evaluation"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Criteria Dialog */}
      <Dialog open={criteriaDialogOpen} onClose={() => setCriteriaDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle fontWeight={700}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
            Manage DSS Criteria
            <Button size="small" variant="outlined" startIcon={<Add />} onClick={addNewCriterion}>
              Add Criterion
            </Button>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Current draft total weight:{" "}
            <strong>{criteriaDraft.reduce((s, c) => s + Number(c.weight || 0), 0).toFixed(2)}%</strong>. It must equal <strong>100%</strong>.
          </Alert>

          {criteriaDraft.map((c, i) => (
            <Paper key={c.criteria_id} variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                <Chip label={`#${i + 1}`} size="small" />
                <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>{c.criteria_name}</Typography>
                <Tooltip title="Remove criterion">
                  <IconButton size="small" color="error" onClick={() => removeCriterion(i)}>
                    <DeleteOutline fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Criterion Name"
                    size="small"
                    value={c.criteria_name}
                    onChange={(e) => setCriteriaDraft((prev) => prev.map((x, j) => (j === i ? { ...x, criteria_name: e.target.value } : x)))}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Category"
                    size="small"
                    value={c.category}
                    onChange={(e) => setCriteriaDraft((prev) => prev.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Weight (%)"
                    size="small"
                    type="number"
                    value={c.weight}
                    inputProps={{ min: 0, max: 100, step: 1 }}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      setCriteriaDraft((prev) => prev.map((x, j) => (j === i ? { ...x, weight: v } : x)));
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Max Score"
                    size="small"
                    type="number"
                    value={c.max_score}
                    inputProps={{ min: 1, max: 100, step: 1 }}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(100, Number(e.target.value) || 100));
                      setCriteriaDraft((prev) => prev.map((x, j) => (j === i ? { ...x, max_score: v } : x)));
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 9 }}>
                  <TextField
                    fullWidth
                    label="Description"
                    size="small"
                    multiline
                    rows={2}
                    value={c.description}
                    onChange={(e) => setCriteriaDraft((prev) => prev.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                  />
                </Grid>
              </Grid>
            </Paper>
          ))}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCriteriaDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<Save />} onClick={saveCriteria} disabled={saving}>
            Save Criteria
          </Button>
        </DialogActions>
      </Dialog>

      {/* DSS Generate Dialog */}
      <Dialog open={dssDialogOpen} onClose={() => setDssDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Generate DSS Ranking</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            This will rank employees based on approved/submitted evaluations for the selected period.
          </Alert>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Period Start"
                type="date"
                value={dssPeriodStart}
                onChange={(e) => setDssPeriodStart(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Period End"
                type="date"
                value={dssPeriodEnd}
                onChange={(e) => setDssPeriodEnd(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid size={12}>
              <TextField
                fullWidth
                label="Period Label"
                value={dssPeriodLabel}
                onChange={(e) => setDssPeriodLabel(e.target.value)}
                placeholder="Example: May 2026 DSS Ranking"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDssDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleGenerateDss} disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>
            Generate
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
