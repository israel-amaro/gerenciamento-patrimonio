import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Badge, Button, Card, EmptyState, FormField, Icon, InlineMessage, Input, LoadingState, Select } from "../components/ui";
import { useAsyncData } from "../hooks/useAsyncData";
import { assetsApi, lookupApi } from "../lib/api";

const buildQrCodeUrl = (assetId) => {
  if (typeof window === "undefined") {
    return `/app/audits/${assetId}`;
  }

  return `${window.location.origin}/app/audits/${assetId}`;
};

const createInitialForm = () => {
  const id = crypto.randomUUID();

  return {
    id,
    type_id: "",
    tag_code: "",
    qr_code_value: buildQrCodeUrl(id),
    serial_number: "",
    host_name: "",
    domain_name: "",
    model: "",
    status: "available",
    lab_id: "",
    acquisition_date: "",
    notes: ""
  };
};

const statusLabel = {
  available: ["Disponivel", "success"],
  in_use: ["Em uso", "default"],
  maintenance: ["Manutencao", "warning"],
  defective: ["Defeituoso", "destructive"],
  missing: ["Extraviado", "destructive"],
  retired: ["Baixado", "outline"]
};

const AssetsPage = () => {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(createInitialForm);
  const [isEditing, setIsEditing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [qrPreview, setQrPreview] = useState("");

  const assets = useAsyncData(() => assetsApi.list(search), [search]);
  const lookups = useAsyncData(async () => {
    const [assetTypes, labs] = await Promise.all([lookupApi.assetTypes(), lookupApi.labs()]);
    return { assetTypes, labs };
  }, []);

  useEffect(() => {
    setFeedback("");
  }, [showForm]);

  useEffect(() => {
    let active = true;

    const generateQrPreview = async () => {
      if (!form.qr_code_value) {
        setQrPreview("");
        return;
      }

      try {
        const image = await QRCode.toDataURL(form.qr_code_value, {
          margin: 1,
          width: 220
        });

        if (active) {
          setQrPreview(image);
        }
      } catch (_error) {
        if (active) {
          setQrPreview("");
        }
      }
    };

    generateQrPreview();

    return () => {
      active = false;
    };
  }, [form.qr_code_value]);

  const resetForm = () => {
    setForm(createInitialForm());
    setIsEditing(false);
    setShowForm(false);
  };

  const handleCreate = () => {
    setForm(createInitialForm());
    setIsEditing(false);
    setShowForm(true);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleEdit = (asset) => {
    setForm({
      id: asset.id,
      type_id: asset.type_id || "",
      tag_code: asset.tag_code || "",
      qr_code_value: asset.qr_code_value || buildQrCodeUrl(asset.id),
      serial_number: asset.serial_number || "",
      host_name: asset.host_name || "",
      domain_name: asset.domain_name || "",
      model: asset.model || "",
      status: asset.status || "available",
      lab_id: asset.lab_id || "",
      acquisition_date: asset.acquisition_date || "",
      notes: asset.notes || ""
    });
    setIsEditing(true);
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback("");
    setSubmitting(true);

    try {
      if (!form.type_id || !form.tag_code || !form.model) {
        throw new Error("Preencha tipo, patrimonio/tag e modelo.");
      }

      const payload = {
        id: form.id,
        type_id: form.type_id,
        tag_code: form.tag_code.trim(),
        qr_code_value: form.qr_code_value.trim(),
        serial_number: form.serial_number.trim() || null,
        host_name: form.host_name.trim() || null,
        domain_name: form.domain_name.trim() || null,
        model: form.model.trim(),
        status: form.status,
        lab_id: form.lab_id || null,
        acquisition_date: form.acquisition_date || null,
        notes: form.notes.trim() || null
      };

      if (isEditing) {
        await assetsApi.update(form.id, payload);
      } else {
        await assetsApi.create(payload);
      }

      setFeedback("Ativo salvo com sucesso.");
      resetForm();
      await assets.reload();
    } catch (err) {
      setFeedback(err.message || "Nao foi possivel salvar o ativo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Ativos</h1>
        <Button onClick={() => (showForm ? setShowForm(false) : handleCreate())}>
          <Icon name="plus" className="mr-2" />
          {showForm ? "Fechar" : "Novo Ativo"}
        </Button>
      </div>

      {showForm ? (
        <Card>
          <form className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4" onSubmit={handleSubmit}>
            <FormField label="Tipo">
              <Select name="type_id" value={form.type_id} onChange={handleChange}>
                <option value="">Selecione</option>
                {lookups.data?.assetTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Patrimonio / Tag">
              <Input name="tag_code" value={form.tag_code} onChange={handleChange} />
            </FormField>
            <FormField label="Modelo">
              <Input name="model" value={form.model} onChange={handleChange} />
            </FormField>
            <FormField label="Nome da maquina">
              <Input name="host_name" value={form.host_name} onChange={handleChange} placeholder="Ex: LAB01-PC07" />
            </FormField>
            <FormField label="Dominio">
              <Input name="domain_name" value={form.domain_name} onChange={handleChange} placeholder="Ex: finds.local" />
            </FormField>
            <FormField label="Serial">
              <Input name="serial_number" value={form.serial_number} onChange={handleChange} />
            </FormField>
            <FormField label="Localizacao">
              <Select name="lab_id" value={form.lab_id} onChange={handleChange}>
                <option value="">Sem laboratorio</option>
                {lookups.data?.labs.map((lab) => (
                  <option key={lab.id} value={lab.id}>{lab.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Status">
              <Select name="status" value={form.status} onChange={handleChange}>
                {Object.entries(statusLabel).map(([value, [label]]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Aquisicao">
              <Input name="acquisition_date" type="date" value={form.acquisition_date} onChange={handleChange} />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Link salvo no QR">
                <Input name="qr_code_value" value={form.qr_code_value} onChange={handleChange} />
              </FormField>
            </div>
            <div className="md:col-span-1">
              <FormField label="Preview do QR">
                <div className="min-h-40 rounded-md border border-dashed border-border bg-muted/20 flex items-center justify-center p-4">
                  {qrPreview ? (
                    <img src={qrPreview} alt={`QR Code do ativo ${form.tag_code || form.id}`} className="h-36 w-36" />
                  ) : (
                    <span className="text-sm text-muted-foreground">QR indisponivel</span>
                  )}
                </div>
              </FormField>
            </div>
            <div className="md:col-span-3">
              <FormField label="Observacoes">
                <Input name="notes" value={form.notes} onChange={handleChange} />
              </FormField>
            </div>
            {feedback ? <div className="md:col-span-3"><InlineMessage tone={feedback.includes("sucesso") ? "success" : "error"}>{feedback}</InlineMessage></div> : null}
            <div className="md:col-span-3 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Salvar ativo"}</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        <div className="p-4 border-b bg-muted/20 relative">
          <Icon name="search" className="absolute left-7 top-7 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar por tag, nome da maquina, dominio ou serial..."
            className="pl-9 max-w-sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          {assets.loading ? <div className="p-4"><LoadingState /></div> : null}
          {assets.error ? <div className="p-4"><InlineMessage tone="error">{assets.error}</InlineMessage></div> : null}
          {!assets.loading && !assets.error && assets.data?.length === 0 ? (
            <EmptyState title="Nenhum ativo encontrado" description="Cadastre o primeiro ativo para comecar." />
          ) : null}
          {assets.data?.length ? (
            <table>
              <thead>
                <tr>
                  <th>Patrimonio / Tag</th>
                  <th>Maquina</th>
                  <th>Dominio</th>
                  <th>Modelo</th>
                  <th>Localizacao</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {assets.data.map((asset) => (
                  <tr key={asset.id} className="hover:bg-muted/50">
                    <td className="font-medium">{asset.tag_code}</td>
                    <td>{asset.host_name || "-"}</td>
                    <td>{asset.domain_name || "-"}</td>
                    <td>{asset.model}</td>
                    <td className="text-muted-foreground">{asset.labs?.name || "Sem laboratorio"}</td>
                    <td>
                      <Badge variant={statusLabel[asset.status]?.[1] || "outline"}>
                        {statusLabel[asset.status]?.[0] || asset.status}
                      </Badge>
                    </td>
                    <td>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(asset)}>Editar</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </Card>
    </div>
  );
};

export default AssetsPage;
