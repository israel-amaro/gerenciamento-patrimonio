import { useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, FormField, Icon, InlineMessage, Input, LoadingState, Select, Textarea } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { auditsApi } from "../lib/api";

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

const AuditsPage = () => {
  const { profile } = useAuth();
  const [tagCode, setTagCode] = useState("");
  const [asset, setAsset] = useState(null);
  const [form, setForm] = useState(auditDefaults);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  const findAsset = async () => {
    setFeedback("");
    setLoading(true);

    try {
      const result = await auditsApi.findAssetByTag(tagCode.trim());
      if (!result) {
        throw new Error("Nenhum ativo encontrado para a TAG informada.");
      }
      setAsset(result);
    } catch (err) {
      setAsset(null);
      setFeedback(err.message || "Não foi possível buscar o ativo.");
    } finally {
      setLoading(false);
    }
  };

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
      await auditsApi.create({
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

      setFeedback("Auditoria salva com sucesso.");
      setAsset(null);
      setTagCode("");
      setForm(auditDefaults);
    } catch (err) {
      setFeedback(err.message || "Não foi possível salvar a auditoria.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Auditoria Técnica com QR Code</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="border-b bg-muted/20 flex flex-row items-center gap-2">
            <Icon name="scan-line" className="text-primary mt-1" />
            <CardTitle>Scanner</CardTitle>
          </CardHeader>
          <CardContent className="p-8 text-center flex flex-col items-center gap-4">
            <div className="h-24 w-24 bg-muted rounded-full flex items-center justify-center border-4 border-dashed border-muted-foreground">
              <Icon name="qr-code" className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Abra este app no celular para escanear a etiqueta do equipamento diretamente.
            </p>
            <Button className="w-full" type="button" disabled>Abrir Câmera</Button>
            <div className="flex w-full items-center gap-2 pt-4 border-t">
              <Input placeholder="Ou digite a TAG..." value={tagCode} onChange={(event) => setTagCode(event.target.value)} />
              <Button variant="secondary" type="button" onClick={findAsset}>OK</Button>
            </div>
            {loading ? <LoadingState label="Buscando ativo..." /> : null}
            {feedback ? <InlineMessage tone={feedback.includes("sucesso") ? "success" : "error"}>{feedback}</InlineMessage> : null}
          </CardContent>
        </Card>

        <Card className={!asset ? "opacity-50 pointer-events-none" : ""}>
          <CardHeader className="border-b bg-muted/20">
            <CardTitle>{asset ? `Inspeção ${asset.tag_code}` : "Inspeção"}</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {asset ? (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="text-sm">
                  <div className="font-medium">{asset.model}</div>
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
                <Button type="submit" className="w-full" disabled={saving}>{saving ? "Salvando..." : "Salvar Auditoria"}</Button>
              </form>
            ) : (
              <div className="text-sm">Aguardando escaneamento...</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuditsPage;
