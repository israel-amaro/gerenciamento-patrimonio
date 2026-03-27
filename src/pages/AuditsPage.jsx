import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import qrScannerWorkerPath from "qr-scanner/qr-scanner-worker.min?url";
import { useParams } from "react-router-dom";
import { Button, Card, CardContent, CardHeader, CardTitle, FormField, Icon, InlineMessage, Input, LoadingState, Select, Textarea } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { auditsApi, incidentsApi } from "../lib/api";

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

const extractAssetId = (value) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (uuidPattern.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const lastPart = parts.at(-1) || "";
    return uuidPattern.test(lastPart) ? lastPart : "";
  } catch (_error) {
    const match = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
    return match?.[0] || "";
  }
};

const buildAuditIncident = (asset, form) => {
  const issues = [];

  if (form.status !== "functioning_normally") {
    issues.push(`Status: ${form.status}`);
  }

  if (!form.powers_on) issues.push("Não liga");
  if (!form.internet_working) issues.push("Internet indisponível");
  if (!form.keyboard_ok) issues.push("Teclado com problema");
  if (!form.mouse_ok) issues.push("Mouse com problema");
  if (!form.monitor_ok) issues.push("Monitor com problema");
  if (!form.no_physical_damage) issues.push("Dano físico identificado");
  if (form.notes.trim()) issues.push(form.notes.trim());

  if (!issues.length) {
    return null;
  }

  return {
    asset_id: asset.id,
    title: `Falha identificada na auditoria do ativo ${asset.tag_code}`,
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
  const [asset, setAsset] = useState(null);
  const [form, setForm] = useState(auditDefaults);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);

  const stopScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
  };

  const findAsset = async (reference = lookupValue) => {
    const trimmedReference = reference.trim();

    if (!trimmedReference) {
      setAsset(null);
      setFeedback("Informe a TAG, o link do QR ou o ID do ativo.");
      return;
    }

    setFeedback("");
    setLoading(true);

    try {
      const parsedAssetId = extractAssetId(trimmedReference);
      let result = null;

      if (parsedAssetId) {
        result = await auditsApi.findAssetById(parsedAssetId);
      }

      if (!result) {
        result = await auditsApi.findAssetByQrValue(trimmedReference);
      }

      if (!result) {
        result = await auditsApi.findAssetByTag(trimmedReference);
      }

      if (!result) {
        throw new Error("Nenhum ativo encontrado para a referência informada.");
      }

      setAsset(result);
      setLookupValue(result.qr_code_value || result.tag_code);
    } catch (err) {
      setAsset(null);
      setFeedback(err.message || "Não foi possível buscar o ativo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!assetId) {
      return;
    }

    setLookupValue(assetId);
    findAsset(assetId);
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
            await findAsset(scannedValue);
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
      } catch (err) {
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
  }, [cameraOpen]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleBooleanChange = (name, value) => {
    setForm((current) => ({ ...current, [name]: value === "true" }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback("");
    setSaving(true);

    try {
      const audit = await auditsApi.create({
        auditor_id: profile.id,
        asset_id: asset.id,
        status: form.status,
        powers_on: form.powers_on,
        internet_working: form.internet_working,
        keyboard_ok: form.keyboard_ok,
        mouse_ok: form.mouse_ok,
        monitor_ok: form.monitor_ok,
        no_physical_damage: form.no_physical_damage,
        notes: form.notes.trim() || null
      });

      const incident = buildAuditIncident(asset, form);
      if (incident) {
        await incidentsApi.createEvent({
          ...incident,
          reported_by: profile.id,
          source_reference_id: audit.id
        });
      }

      setFeedback("Auditoria salva com sucesso.");
      setAsset(null);
      setLookupValue("");
      setForm(auditDefaults);
    } catch (err) {
      setFeedback(err.message || "Não foi possível salvar a auditoria.");
    } finally {
      setSaving(false);
    }
  };

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
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-dashed border-muted-foreground bg-muted">
              <Icon name="qr-code" className="h-10 w-10 text-muted-foreground" />
            </div>

            <p className="text-sm text-muted-foreground">
              Aponte a câmera para o QR Code do ativo ou cole manualmente o link, o ID ou a TAG.
            </p>

            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button className="w-full" type="button" onClick={() => setCameraOpen((current) => !current)}>
                {cameraOpen ? "Fechar câmera" : "Abrir câmera"}
              </Button>
              <Button className="w-full" variant="secondary" type="button" onClick={() => findAsset()}>
                Buscar ativo
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
                placeholder="Cole o link do QR, ID do ativo ou TAG..."
                value={lookupValue}
                onChange={(event) => setLookupValue(event.target.value)}
              />
              <Button variant="secondary" type="button" onClick={() => findAsset()}>OK</Button>
            </div>

            {loading ? <LoadingState label="Buscando ativo..." /> : null}
            {feedback ? <InlineMessage tone={feedback.includes("sucesso") ? "success" : "error"}>{feedback}</InlineMessage> : null}
          </CardContent>
        </Card>

        <Card className={!asset ? "pointer-events-none opacity-50" : ""}>
          <CardHeader className="border-b bg-muted/20">
            <CardTitle>{asset ? `Inspeção ${asset.tag_code}` : "Inspeção"}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 p-6">
            {asset ? (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1 text-sm">
                  <div className="font-medium">{asset.model}</div>
                  <div className="text-muted-foreground">{asset.host_name || "Sem nome de máquina"}</div>
                  <div className="text-muted-foreground">{asset.domain_name || "Sem domínio"}</div>
                  <div className="text-muted-foreground">{asset.labs?.name || "Sem laboratório"}</div>
                </div>

                <FormField label="Status geral">
                  <Select name="status" value={form.status} onChange={handleChange}>
                    <option value="functioning_normally">Funcionando normalmente</option>
                    <option value="functioning_with_issue">Funcionando com falha</option>
                    <option value="not_functioning">Não está funcionando</option>
                    <option value="missing">Extraviado</option>
                  </Select>
                </FormField>

                {[
                  ["powers_on", "Liga"],
                  ["internet_working", "Internet funcionando"],
                  ["keyboard_ok", "Teclado OK"],
                  ["mouse_ok", "Mouse OK"],
                  ["monitor_ok", "Monitor OK"],
                  ["no_physical_damage", "Sem dano físico"]
                ].map(([name, label]) => (
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
    </div>
  );
};

export default AuditsPage;
