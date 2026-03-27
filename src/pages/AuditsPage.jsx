import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import qrScannerWorkerPath from "qr-scanner/qr-scanner-worker.min?url";
import { useParams } from "react-router-dom";
import { Button, Card, CardContent, CardHeader, CardTitle, FormField, Icon, InlineMessage, Input, LoadingState, Select, Textarea } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useAsyncData } from "../hooks/useAsyncData";
import { auditsApi, incidentsApi } from "../lib/api";
import { formatDateTime } from "../lib/utils";

QrScanner.WORKER_PATH = qrScannerWorkerPath;

const auditDefaults = {
  status: "functioning_normally",
  powers_on: true,
  internet_working: true,
  keyboard_ok: true,
  mouse_ok: true,
  monitor_ok: true,
  no_physical_damage: true,
  notes: ""
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const targetConfig = {
  asset: {
    title: "ativo",
    inspectTitle: "Inspeção do ativo",
    lookupHint: "Aponte a câmera para o QR Code do ativo ou cole manualmente o link, o ID ou a TAG.",
    getName: (item) => item.tag_code,
    getSecondary: (item) => [item.model, item.host_name, item.domain_name, item.labs?.name].filter(Boolean),
    checks: [
      ["powers_on", "Liga"],
      ["internet_working", "Internet funcionando"],
      ["keyboard_ok", "Teclado OK"],
      ["mouse_ok", "Mouse OK"],
      ["monitor_ok", "Monitor OK"],
      ["no_physical_damage", "Sem dano físico"]
    ],
    incidentTitle: (item) => `Falha identificada na auditoria do ativo ${item.tag_code}`
  },
  box: {
    title: "carrinho",
    inspectTitle: "Inspeção do carrinho",
    lookupHint: "Leia o QR do carrinho ou cole manualmente o link ou o ID.",
    getName: (item) => item.name,
    getSecondary: (item) => [item.description, item.expected_asset_count ? `${item.expected_asset_count} itens esperados` : null].filter(Boolean),
    checks: [
      ["powers_on", "Estrutura OK"],
      ["internet_working", "Rodízios e travas OK"],
      ["keyboard_ok", "Carregadores presentes"],
      ["mouse_ok", "Organização interna OK"],
      ["monitor_ok", "QR visível"],
      ["no_physical_damage", "Sem dano físico"]
    ],
    incidentTitle: (item) => `Falha identificada na auditoria do carrinho ${item.name}`
  },
  lab: {
    title: "laboratório",
    inspectTitle: "Inspeção do laboratório",
    lookupHint: "Leia o QR do laboratório ou cole manualmente o link ou o ID.",
    getName: (item) => item.name,
    getSecondary: (item) => [item.location].filter(Boolean),
    checks: [
      ["powers_on", "Equipamentos disponíveis"],
      ["internet_working", "Internet funcionando"],
      ["keyboard_ok", "Periféricos OK"],
      ["mouse_ok", "Ambiente organizado"],
      ["monitor_ok", "QR visível"],
      ["no_physical_damage", "Sem dano físico"]
    ],
    incidentTitle: (item) => `Falha identificada na auditoria do laboratório ${item.name}`
  }
};

const getScanTargetFromReference = (value) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return { kind: null, id: "" };
  }

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const scanIndex = parts.findIndex((part) => part === "scan");
    if (scanIndex >= 0) {
      const kind = parts[scanIndex + 1];
      const id = parts[scanIndex + 2];
      if (["asset", "box", "lab"].includes(kind) && uuidPattern.test(id || "")) {
        return { kind, id };
      }
    }

    const auditIndex = parts.findIndex((part) => part === "audits");
    if (auditIndex >= 0) {
      const id = parts[auditIndex + 1];
      if (uuidPattern.test(id || "")) {
        return { kind: "asset", id };
      }
    }
  } catch (_error) {
    // ignore
  }

  if (uuidPattern.test(trimmed)) {
    return { kind: null, id: trimmed };
  }

  const match = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return { kind: null, id: match?.[0] || "" };
};

const buildIncidentPayload = (targetType, target, form) => {
  const issues = [];

  if (form.status !== "functioning_normally") {
    issues.push(`Status: ${form.status}`);
  }

  targetConfig[targetType].checks.forEach(([field, label]) => {
    if (!form[field]) {
      issues.push(label);
    }
  });

  if (form.notes.trim()) {
    issues.push(form.notes.trim());
  }

  if (!issues.length) {
    return null;
  }

  return {
    asset_id: targetType === "asset" ? target.id : null,
    box_id: targetType === "box" ? target.id : null,
    lab_id: targetType === "lab" ? target.id : null,
    title: targetConfig[targetType].incidentTitle(target),
    description: issues.join(" | "),
    severity: form.status === "not_functioning" || form.status === "missing" ? "high" : "medium",
    source: "audit"
  };
};

const AuditsPage = () => {
  const { assetId } = useParams();
  const { profile } = useAuth();
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const [lookupValue, setLookupValue] = useState(assetId || "");
  const [targetType, setTargetType] = useState("asset");
  const [target, setTarget] = useState(null);
  const [form, setForm] = useState(auditDefaults);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const history = useAsyncData(() => auditsApi.list({ limit: 12 }), []);

  const stopScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
  };

  const findTarget = async (reference = lookupValue, preferredType = targetType) => {
    const trimmedReference = reference.trim();

    if (!trimmedReference) {
      setTarget(null);
      setFeedback("Informe o link do QR, o ID ou a TAG do item.");
      return;
    }

    setFeedback("");
    setLoading(true);

    try {
      const parsed = getScanTargetFromReference(trimmedReference);
      const candidates = parsed.kind
        ? [parsed.kind]
        : preferredType === "asset"
          ? ["asset", "box", "lab"]
          : preferredType === "box"
            ? ["box", "asset", "lab"]
            : ["lab", "asset", "box"];

      let result = null;
      let kind = null;

      for (const candidate of candidates) {
        if (candidate === "asset") {
          result =
            (parsed.id ? await auditsApi.findAssetById(parsed.id) : null) ||
            (await auditsApi.findAssetByQrValue(trimmedReference)) ||
            (await auditsApi.findAssetByTag(trimmedReference));
        } else if (candidate === "box") {
          result =
            (parsed.id ? await auditsApi.findBoxById(parsed.id) : null) ||
            (await auditsApi.findBoxByQrValue(trimmedReference));
        } else if (candidate === "lab") {
          result =
            (parsed.id ? await auditsApi.findLabById(parsed.id) : null) ||
            (await auditsApi.findLabByQrValue(trimmedReference));
        }

        if (result) {
          kind = candidate;
          break;
        }
      }

      if (!result || !kind) {
        throw new Error("Nenhum item encontrado para a referência informada.");
      }

      setTarget(result);
      setTargetType(kind);
      setLookupValue(result.qr_code_value || result.tag_code || result.name || trimmedReference);
    } catch (err) {
      setTarget(null);
      setFeedback(err.message || "Não foi possível localizar o item.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!assetId) {
      return;
    }

    setLookupValue(assetId);
    findTarget(assetId, "asset");
  }, [assetId]);

  useEffect(() => {
    let active = true;

    const startScanner = async () => {
      if (!cameraOpen || !videoRef.current) {
        return;
      }

      setCameraLoading(true);
      setFeedback("");

      try {
        const scanner = new QrScanner(
          videoRef.current,
          async (result) => {
            if (!active) {
              return;
            }

            const scannedValue = result?.data || "";
            setLookupValue(scannedValue);
            setCameraOpen(false);
            await stopScanner();
            await findTarget(scannedValue, targetType);
          },
          {
            preferredCamera: "environment",
            returnDetailedScanResult: true,
            highlightScanRegion: true,
            highlightCodeOutline: true
          }
        );

        scannerRef.current = scanner;
        await scanner.start();
      } catch (_err) {
        setCameraOpen(false);
        setFeedback("Não foi possível acessar a câmera. Verifique a permissão do navegador.");
      } finally {
        if (active) {
          setCameraLoading(false);
        }
      }
    };

    startScanner();

    return () => {
      active = false;
      stopScanner();
    };
  }, [cameraOpen, targetType]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleBooleanChange = (name, value) => {
    setForm((current) => ({ ...current, [name]: value === "true" }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!target) {
      return;
    }

    setFeedback("");
    setSaving(true);

    try {
      const payload = {
        auditor_id: profile.id,
        asset_id: targetType === "asset" ? target.id : null,
        box_id: targetType === "box" ? target.id : null,
        lab_id: targetType === "lab" ? target.id : null,
        status: form.status,
        powers_on: form.powers_on,
        internet_working: form.internet_working,
        keyboard_ok: form.keyboard_ok,
        mouse_ok: form.mouse_ok,
        monitor_ok: form.monitor_ok,
        no_physical_damage: form.no_physical_damage,
        notes: form.notes.trim() || null
      };

      const audit = await auditsApi.create(payload);
      const incident = buildIncidentPayload(targetType, target, form);

      if (incident) {
        await incidentsApi.createEvent({
          ...incident,
          reported_by: profile.id,
          source_reference_id: audit.id
        });
      }

      setFeedback("Auditoria salva com sucesso.");
      setTarget(null);
      setLookupValue("");
      setForm(auditDefaults);
      await history.reload();
    } catch (err) {
      setFeedback(err.message || "Não foi possível salvar a auditoria.");
    } finally {
      setSaving(false);
    }
  };

  const config = targetConfig[targetType];
  const getHistoryType = (audit) => {
    if (audit.box_id) return "Carrinho";
    if (audit.lab_id) return "Laboratório";
    return "Ativo";
  };
  const getHistoryTarget = (audit) => audit.assets?.tag_code || audit.boxes?.name || audit.labs?.name || "-";
  const getHistoryAuditor = (audit) => audit.profiles?.full_name || "Admin";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Auditoria técnica com QR Code</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 border-b bg-muted/20">
            <Icon name="scan-line" className="mt-1 text-primary" />
            <CardTitle>Leitura do QR</CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="w-full">
              <FormField label="Tipo de auditoria">
                <Select value={targetType} onChange={(event) => setTargetType(event.target.value)}>
                  <option value="asset">Ativo</option>
                  <option value="box">Carrinho</option>
                  <option value="lab">Laboratório</option>
                </Select>
              </FormField>
            </div>

            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-dashed border-muted-foreground bg-muted">
              <Icon name="qr-code" className="h-10 w-10 text-muted-foreground" />
            </div>

            <p className="text-sm text-muted-foreground">{config.lookupHint}</p>

            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button className="w-full" type="button" onClick={() => setCameraOpen((current) => !current)}>
                {cameraOpen ? "Fechar câmera" : "Abrir câmera"}
              </Button>
              <Button className="w-full" variant="secondary" type="button" onClick={() => findTarget()}>
                Buscar
              </Button>
            </div>

            {cameraOpen ? (
              <div className="w-full rounded-lg border bg-black p-2">
                <video ref={videoRef} className="aspect-[4/3] w-full rounded-md object-cover" muted playsInline />
                <div className="mt-2 text-sm text-white/80">
                  {cameraLoading ? "Iniciando câmera..." : "Posicione o QR dentro da área da câmera."}
                </div>
              </div>
            ) : null}

            <div className="flex w-full items-center gap-2 border-t pt-4">
              <Input
                placeholder="Cole o link do QR, ID ou TAG..."
                value={lookupValue}
                onChange={(event) => setLookupValue(event.target.value)}
              />
              <Button variant="secondary" type="button" onClick={() => findTarget()}>OK</Button>
            </div>

            {loading ? <LoadingState label="Buscando item..." /> : null}
            {feedback ? <InlineMessage tone={feedback.includes("sucesso") ? "success" : "error"}>{feedback}</InlineMessage> : null}
          </CardContent>
        </Card>

        <Card className={!target ? "pointer-events-none opacity-50" : ""}>
          <CardHeader className="border-b bg-muted/20">
            <CardTitle>{target ? `${config.inspectTitle}: ${config.getName(target)}` : "Inspeção"}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 p-6">
            {target ? (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1 text-sm">
                  <div className="font-medium">{config.getName(target)}</div>
                  {config.getSecondary(target).map((line) => (
                    <div key={line} className="text-muted-foreground">{line}</div>
                  ))}
                </div>

                <FormField label="Status geral">
                  <Select name="status" value={form.status} onChange={handleChange}>
                    <option value="functioning_normally">Funcionando normalmente</option>
                    <option value="functioning_with_issue">Funcionando com ressalvas</option>
                    <option value="not_functioning">Precisa de manutenção</option>
                    <option value="missing">Indisponível</option>
                  </Select>
                </FormField>

                {config.checks.map(([name, label]) => (
                  <FormField key={name} label={label}>
                    <Select value={String(form[name])} onChange={(event) => handleBooleanChange(name, event.target.value)}>
                      <option value="true">Sim</option>
                      <option value="false">Não</option>
                    </Select>
                  </FormField>
                ))}

                <FormField label="Observações">
                  <Textarea name="notes" value={form.notes} onChange={handleChange} />
                </FormField>

                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar auditoria"}
                </Button>
              </form>
            ) : (
              <div className="text-sm text-muted-foreground">Aguardando leitura do QR Code...</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle>Histórico de auditorias técnicas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history.loading ? <div className="p-6"><LoadingState label="Carregando histórico..." /></div> : null}
          {history.error ? <div className="p-6"><InlineMessage tone="error">{history.error}</InlineMessage></div> : null}
          {!history.loading && !history.error && !history.data?.length ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhuma auditoria registrada até o momento.</div>
          ) : null}
          {history.data?.length ? (
            <div className="divide-y">
              {history.data.map((audit) => (
                <div key={audit.id} className="grid gap-3 p-4 md:grid-cols-[110px_1fr_180px_150px] md:items-start">
                  <div className="text-sm font-medium">{getHistoryType(audit)}</div>
                  <div className="space-y-1">
                    <div className="font-medium">{getHistoryTarget(audit)}</div>
                    <div className="text-sm text-muted-foreground">{audit.notes || "Sem observações registradas."}</div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>{audit.status}</div>
                    <div className="text-muted-foreground">{getHistoryAuditor(audit)}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">{formatDateTime(audit.audited_at)}</div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditsPage;
