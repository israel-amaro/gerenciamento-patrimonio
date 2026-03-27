import { useState } from "react";
import { Badge, Button, Card, EmptyState, FormField, Icon, InlineMessage, Input, LoadingState, Select } from "../components/ui";
import { useAsyncData } from "../hooks/useAsyncData";
import { loansApi, lookupApi } from "../lib/api";
import { formatDateTime } from "../lib/utils";

const initialForm = {
  box_id: "",
  responsible_name: "",
  room_id: "",
  room_name: "",
  session_class: "",
  expected_return_at: "",
  notes: ""
};

const statusMap = {
  active: ["Em andamento", "default"],
  returned: ["Devolvido", "success"],
  overdue: ["Atrasado", "warning"]
};

const targetTypeOptions = {
  all: "Tudo",
  box: "Carrinhos",
  asset: "Ativos",
  lab: "Laboratórios"
};

const LoansPage = () => {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [targetType, setTargetType] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loans = useAsyncData(() => loansApi.list({ search, dateFrom, dateTo, targetType }), [search, dateFrom, dateTo, targetType]);
  const lookups = useAsyncData(async () => {
    const [boxes, rooms, assets, labs] = await Promise.all([lookupApi.boxes(), lookupApi.rooms(), lookupApi.assets(), lookupApi.labs()]);
    return { boxes, rooms, assets, labs };
  }, []);

  const getBoxName = (boxId) => lookups.data?.boxes.find((box) => box.id === boxId)?.name || boxId;
  const getAssetName = (assetId) => {
    const asset = lookups.data?.assets.find((item) => item.id === assetId);
    return asset ? `${asset.tag_code} - ${asset.model}` : assetId;
  };
  const getLabName = (labId) => lookups.data?.labs.find((lab) => lab.id === labId)?.name || labId;
  const getRoomName = (roomId) => lookups.data?.rooms.find((room) => room.id === roomId)?.name || roomId;

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === "room_id") {
      const selectedRoom = lookups.data?.rooms.find((room) => room.id === value);
      setForm((current) => ({
        ...current,
        room_id: value,
        room_name: selectedRoom?.name || current.room_name
      }));
      return;
    }

    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback("");
    setSubmitting(true);

    try {
      if (!form.box_id || !form.session_class || !form.expected_return_at || !form.responsible_name.trim()) {
        throw new Error("Preencha carrinho, responsável, turma e previsão de devolução.");
      }

      await loansApi.create({
        box_id: form.box_id,
        responsible_name: form.responsible_name.trim(),
        room_id: form.room_id || null,
        room_name: form.room_name.trim() || null,
        session_class: form.session_class.trim(),
        expected_return_at: new Date(form.expected_return_at).toISOString(),
        notes: form.notes.trim() || null,
        status: "active"
      });

      setForm(initialForm);
      setShowForm(false);
      await loans.reload();
    } catch (err) {
      setFeedback(err.message || "Não foi possível registrar o empréstimo.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async (loan) => {
    try {
      await loansApi.markReturned(loan.id);
      await loans.reload();
    } catch (err) {
      setFeedback(err.message || "Não foi possível registrar a devolução.");
    }
  };

  const getTargetLabel = (loan) => {
    if (loan.box_id) return getBoxName(loan.box_id);
    if (loan.lab_id) return getLabName(loan.lab_id);
    return getAssetName(loan.asset_id);
  };

  const getTargetTypeLabel = (loan) => {
    if (loan.box_id) return "Carrinho";
    if (loan.lab_id) return "Laboratório";
    return "Ativo";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Movimentação e histórico de uso</h1>
        <Button onClick={() => setShowForm((current) => !current)}>
          <Icon name="plus" className="mr-2" />
          {showForm ? "Fechar" : "Novo empréstimo"}
        </Button>
      </div>

      {showForm ? (
        <Card>
          <form className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2" onSubmit={handleSubmit}>
            <FormField label="Carrinho">
              <Select name="box_id" value={form.box_id} onChange={handleChange}>
                <option value="">Selecione</option>
                {lookups.data?.boxes.map((box) => (
                  <option key={box.id} value={box.id}>{box.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Responsável">
              <Input name="responsible_name" value={form.responsible_name} onChange={handleChange} />
            </FormField>
            <FormField label="Sala cadastrada">
              <Select name="room_id" value={form.room_id} onChange={handleChange}>
                <option value="">Selecione</option>
                {lookups.data?.rooms.map((room) => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Sala / Local livre">
              <Input name="room_name" value={form.room_name} onChange={handleChange} placeholder="Ex: Sala 12, Bloco B, Laboratório Maker" />
            </FormField>
            <FormField label="Turma / Disciplina">
              <Input name="session_class" value={form.session_class} onChange={handleChange} />
            </FormField>
            <FormField label="Previsão de devolução">
              <Input name="expected_return_at" type="datetime-local" value={form.expected_return_at} onChange={handleChange} />
            </FormField>
            <FormField label="Observações">
              <Input name="notes" value={form.notes} onChange={handleChange} />
            </FormField>
            {feedback ? <div className="md:col-span-2"><InlineMessage tone="error">{feedback}</InlineMessage></div> : null}
            <div className="flex justify-end gap-2 md:col-span-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Salvar empréstimo"}</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 p-4">
          <Input placeholder="Buscar movimentação..." className="max-w-sm" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          <Select className="max-w-44" value={targetType} onChange={(event) => setTargetType(event.target.value)}>
            {Object.entries(targetTypeOptions).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>

        <div className="overflow-x-auto">
          {loans.loading ? <div className="p-4"><LoadingState /></div> : null}
          {loans.error ? <div className="p-4"><InlineMessage tone="error">{loans.error}</InlineMessage></div> : null}
          {!loans.loading && !loans.error && loans.data?.length === 0 ? (
            <EmptyState title="Nenhuma movimentação encontrada" description="Use os filtros acima para localizar o histórico de uso por período." />
          ) : null}
          {loans.data?.length ? (
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Item</th>
                  <th>Responsável</th>
                  <th>Local / Turma</th>
                  <th>Retirada</th>
                  <th>Previsão</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loans.data.map((loan) => (
                  <tr key={loan.id} className="hover:bg-muted/50">
                    <td>{getTargetTypeLabel(loan)}</td>
                    <td className="font-medium">{getTargetLabel(loan)}</td>
                    <td>{loan.responsible_name}</td>
                    <td className="text-muted-foreground">{loan.room_name || getRoomName(loan.room_id) || "-"} / {loan.session_class}</td>
                    <td>{formatDateTime(loan.borrowed_at)}</td>
                    <td>{formatDateTime(loan.expected_return_at)}</td>
                    <td>
                      <Badge variant={statusMap[loan.status]?.[1] || "outline"}>
                        {statusMap[loan.status]?.[0] || loan.status}
                      </Badge>
                    </td>
                    <td>
                      {loan.status !== "returned" ? (
                        <Button size="sm" onClick={() => handleReturn(loan)}>Devolver</Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">Concluído</span>
                      )}
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

export default LoansPage;
