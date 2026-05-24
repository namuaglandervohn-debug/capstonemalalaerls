import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Button,
  Chip,
} from "@mui/material";
import {
  AccessTime,
  ArticleOutlined,
  BadgeOutlined,
  CalendarMonth,
  CheckCircleOutline,
  PersonOutline,
  Print,
} from "@mui/icons-material";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";

interface DTRRecord {
  id?: string;
  attendance_id?: string;
  employee_id: string;
  attendance_date: string;
  am_arrival?: string;
  am_departure?: string;
  pm_arrival?: string;
  pm_departure?: string;
  overtime_arrival?: string;
  overtime_departure?: string;
  total_hours?: number | string;
}

const GREEN_UI = {
  pageBg: "radial-gradient(circle at top left, rgba(220, 246, 219, 0.95), rgba(248, 252, 245, 0.98) 34%, #f7fbf3 100%)",
  cardBg: "rgba(255, 255, 255, 0.92)",
  cardBgSoft: "rgba(245, 252, 241, 0.88)",
  border: "rgba(139, 184, 144, 0.24)",
  borderStrong: "rgba(73, 156, 92, 0.32)",
  green: "#3aa865",
  greenDark: "#1f7a46",
  greenSoft: "#e6f8e9",
  text: "#1e2d24",
  muted: "#6c7d70",
  shadow: "0 20px 55px rgba(43, 91, 55, 0.10)",
  shadowSoft: "0 12px 28px rgba(43, 91, 55, 0.08)",
};

const softCardSx = {
  borderRadius: "26px",
  border: `1px solid ${GREEN_UI.border}`,
  background: GREEN_UI.cardBg,
  boxShadow: GREEN_UI.shadow,
};


const pillButtonSx = {
  borderRadius: 999,
  textTransform: "none",
  fontWeight: 800,
  px: 2,
};

const tableCellSx = {
  border: "1px solid #000",
  padding: "3px 4px",
  fontSize: 11,
  lineHeight: 1.1,
};

const printPaperSx = {
  p: { xs: 1.5, sm: 2.5 },
  border: `1px solid ${GREEN_UI.border}`,
  borderRadius: "20px",
  maxWidth: 760,
  mx: "auto",
  background: "#fff",
  boxShadow: "0 16px 38px rgba(43, 91, 55, 0.08)",

  "@media print": {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    maxWidth: "none",
    m: 0,
    p: "4mm",
    border: "none",
    borderRadius: 0,
    boxShadow: "none",
  },
};

const printStyles = `
  @media print {
    @page {
      size: A4 portrait;
      margin: 6mm;
    }

    body * {
      visibility: hidden !important;
    }

    .dtr-print-area,
    .dtr-print-area * {
      visibility: visible !important;
    }

    .no-print {
      display: none !important;
    }

    .dtr-table th,
    .dtr-table td {
      padding: 2px 3px !important;
      font-size: 9.5px !important;
      line-height: 1 !important;
    }
  }
`;

export default function EmployeeDTR() {
  const { user } = useAuth();

  const [records, setRecords] = useState<DTRRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const monthName = now.toLocaleString("default", { month: "long" });
  const year = now.getFullYear();
  const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate();

  const fetchDTR = async () => {
    if (!user?.employeeId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("employee_id", user.employeeId)
      .order("attendance_date", { ascending: true });

    if (error) {
      console.error("DTR fetch error:", error);
    } else {
      setRecords(data ?? []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchDTR();
  }, [user]);

  const recordMap = useMemo(() => {
    const map = new Map<number, DTRRecord>();

    records.forEach((record) => {
      const day = new Date(record.attendance_date).getDate();
      map.set(day, record);
    });

    return map;
  }, [records]);

  const totalHours = useMemo(
    () =>
      records.reduce((sum, record) => {
        const value = Number(record.total_hours ?? 0);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0),
    [records]
  );

  const latestRecordDate = records.length
    ? new Date(records[records.length - 1].attendance_date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "No record yet";

  const summaryCards = [
    {
      label: "Employee ID",
      value: user?.employeeId ?? "—",
      caption: "Linked employee account",
      icon: <BadgeOutlined fontSize="small" />,
    },
    {
      label: "Month Covered",
      value: `${monthName} ${year}`,
      caption: `${daysInMonth} calendar days included`,
      icon: <CalendarMonth fontSize="small" />,
    },
    {
      label: "Recorded Days",
      value: records.length,
      caption: `Latest: ${latestRecordDate}`,
      icon: <CheckCircleOutline fontSize="small" />,
    },
    {
      label: "Total Hours",
      value: totalHours.toFixed(2),
      caption: "Based on attendance records",
      icon: <AccessTime fontSize="small" />,
    },
  ];

  return (
    <Box
      sx={{
        minHeight: "100%",
        p: { xs: 1.5, sm: 2.25, md: 3 },
        background: GREEN_UI.pageBg,
        color: GREEN_UI.text,
        borderRadius: { xs: 0, md: "32px" },
      }}
    >
      <Box className="no-print">
        <Paper
          elevation={0}
          sx={{
            ...softCardSx,
            p: { xs: 2, sm: 2.75, md: 3.25 },
            mb: 2.5,
            position: "relative",
            overflow: "hidden",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(239,250,235,0.96) 60%, rgba(225,248,224,0.94) 100%)",
            "&:before": {
              content: '""',
              position: "absolute",
              width: 260,
              height: 260,
              borderRadius: "50%",
              right: -90,
              top: -110,
              background: "rgba(76, 175, 80, 0.12)",
            },
            "&:after": {
              content: '""',
              position: "absolute",
              width: 160,
              height: 160,
              borderRadius: "50%",
              left: { xs: "70%", md: "44%" },
              bottom: -95,
              background: "rgba(174, 222, 144, 0.18)",
            },
          }}
        >
          <Box
            sx={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              justifyContent: "space-between",
              alignItems: { xs: "flex-start", md: "center" },
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <Box sx={{ maxWidth: 720 }}>
              <Chip
                icon={<ArticleOutlined />}
                label="Employee DTR Workspace"
                size="small"
                sx={{
                  mb: 1.2,
                  bgcolor: GREEN_UI.greenSoft,
                  color: GREEN_UI.greenDark,
                  fontWeight: 900,
                  borderRadius: 999,
                  "& .MuiChip-icon": { color: GREEN_UI.greenDark },
                }}
              />
              <Typography
                variant="h4"
                fontWeight={900}
                sx={{
                  fontSize: { xs: "1.55rem", sm: "2rem", md: "2.35rem" },
                  color: GREEN_UI.text,
                  letterSpacing: "-0.04em",
                  lineHeight: 1.08,
                  mb: 0.75,
                }}
              >
                My Daily Time Record
              </Typography>
              <Typography variant="body2" sx={{ color: GREEN_UI.muted, maxWidth: 650, lineHeight: 1.7 }}>
                View your monthly Daily Time Record for {monthName} {year}, review attendance entries, and print a clean copy for submission.
              </Typography>
            </Box>

            <Button
              variant="contained"
              startIcon={<Print />}
              onClick={() => window.print()}
              sx={{
                ...pillButtonSx,
                py: 1.1,
                bgcolor: GREEN_UI.green,
                boxShadow: "0 12px 24px rgba(58, 168, 101, 0.25)",
                "&:hover": { bgcolor: GREEN_UI.greenDark, boxShadow: "0 16px 28px rgba(31, 122, 70, 0.28)" },
              }}
            >
              Print DTR
            </Button>
          </Box>
        </Paper>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
            gap: 1.5,
            mb: 2.5,
          }}
        >
          {summaryCards.map((stat) => (
            <Paper
              key={stat.label}
              elevation={0}
              sx={{
                ...softCardSx,
                p: 2,
                minHeight: 126,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                transition: "transform 180ms ease, box-shadow 180ms ease",
                "&:hover": { transform: "translateY(-3px)", boxShadow: "0 22px 48px rgba(43, 91, 55, 0.13)" },
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1.5 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ color: GREEN_UI.muted, fontWeight: 800 }}>
                    {stat.label}
                  </Typography>
                  <Typography
                    variant="h4"
                    fontWeight={900}
                    sx={{
                      color: GREEN_UI.text,
                      mt: 0.5,
                      letterSpacing: "-0.04em",
                      fontSize: { xs: "1.45rem", sm: "1.65rem" },
                      overflowWrap: "anywhere",
                    }}
                  >
                    {stat.value}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: "16px",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: GREEN_UI.greenSoft,
                    color: GREEN_UI.greenDark,
                    flexShrink: 0,
                  }}
                >
                  {stat.icon}
                </Box>
              </Box>
              <Typography variant="caption" sx={{ color: GREEN_UI.muted, mt: 1.2 }}>
                {stat.caption}
              </Typography>
            </Paper>
          ))}
        </Box>
      </Box>

      <Paper
        elevation={0}
        sx={{
          ...softCardSx,
          p: { xs: 1, sm: 1.5 },
          overflow: "hidden",
        }}
      >
        <Box className="no-print" sx={{ mb: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: "16px",
                display: "grid",
                placeItems: "center",
                bgcolor: GREEN_UI.greenSoft,
                color: GREEN_UI.greenDark,
              }}
            >
              <PersonOutline />
            </Box>
            <Box>
              <Typography fontWeight={900} sx={{ color: GREEN_UI.text, letterSpacing: "-0.02em" }}>
                Printable DTR Form
              </Typography>
              <Typography variant="caption" sx={{ color: GREEN_UI.muted }}>
                This section is the exact area that will be included when printed.
              </Typography>
            </Box>
          </Box>
        </Box>

        <Paper className="dtr-print-area" elevation={0} sx={printPaperSx}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 7, gap: 2 }}>
              <CircularProgress size={28} sx={{ color: GREEN_UI.green }} />
              <Typography sx={{ color: GREEN_UI.muted, fontWeight: 700 }}>Loading DTR…</Typography>
            </Box>
          ) : (
            <>
              <Typography align="center" fontWeight="bold" sx={{ mb: 0.5, fontSize: 16 }}>
                DAILY TIME RECORD
              </Typography>

              <Typography
                align="center"
                sx={{
                  borderBottom: "1px solid #000",
                  width: 280,
                  mx: "auto",
                  mb: 0.5,
                  fontSize: 13,
                }}
              >
                {user?.name}
              </Typography>

              <Typography align="center" sx={{ mb: 1.2, fontSize: 12 }}>
                For the month of <b>{monthName} {year}</b>
              </Typography>

              <TableContainer sx={{ overflowX: "auto" }}>
                <Table size="small" className="dtr-table" sx={{ border: "1px solid #000", minWidth: 620 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell rowSpan={2} align="center" sx={tableCellSx}>
                        Date
                      </TableCell>
                      <TableCell colSpan={2} align="center" sx={tableCellSx}>
                        AM
                      </TableCell>
                      <TableCell colSpan={2} align="center" sx={tableCellSx}>
                        PM
                      </TableCell>
                      <TableCell colSpan={2} align="center" sx={tableCellSx}>
                        Overtime
                      </TableCell>
                      <TableCell rowSpan={2} align="center" sx={tableCellSx}>
                        Total Hours
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      {["Arrival", "Depart", "Arrival", "Depart", "Arrival", "Depart"].map((label) => (
                        <TableCell key={label} align="center" sx={tableCellSx}>
                          {label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                      const record = recordMap.get(day);

                      return (
                        <TableRow key={day}>
                          <TableCell align="center" sx={tableCellSx}>{day}</TableCell>
                          <TableCell align="center" sx={tableCellSx}>{record?.am_arrival ?? ""}</TableCell>
                          <TableCell align="center" sx={tableCellSx}>{record?.am_departure ?? ""}</TableCell>
                          <TableCell align="center" sx={tableCellSx}>{record?.pm_arrival ?? ""}</TableCell>
                          <TableCell align="center" sx={tableCellSx}>{record?.pm_departure ?? ""}</TableCell>
                          <TableCell align="center" sx={tableCellSx}>{record?.overtime_arrival ?? ""}</TableCell>
                          <TableCell align="center" sx={tableCellSx}>{record?.overtime_departure ?? ""}</TableCell>
                          <TableCell align="center" sx={tableCellSx}>{record?.total_hours ?? ""}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography sx={{ mt: 1.5, fontSize: 11 }}>
                I CERTIFY on my honor that the above is a true and correct report of the hours of work performed.
              </Typography>

              <Typography
                align="center"
                sx={{
                  mt: 3.5,
                  borderTop: "1px solid #000",
                  width: 240,
                  mx: "auto",
                  fontSize: 11,
                }}
              >
                Employee Signature
              </Typography>

              <Typography
                align="center"
                sx={{
                  mt: 3.5,
                  borderTop: "1px solid #000",
                  width: 240,
                  mx: "auto",
                  fontSize: 11,
                }}
              >
                In-Charge
              </Typography>
            </>
          )}
        </Paper>
      </Paper>

      <style>{printStyles}</style>
    </Box>
  );
}
