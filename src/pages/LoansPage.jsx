import { useState } from "react";
import { Badge, Button, Card, EmptyState, FormField, Icon, InlineMessage, Input, LoadingState, Select } from "../components/ui";
import { useAsyncData } from "../hooks/useAsyncData";
import { loansApi, lookupApi } from "../lib/api";
import { formatDateTime } from "../lib/utils";

const initialForm = {
  box_id: "",
  responsible_name: "",
  room_id: "",
  session_class: "",
  expected_return_at: "",
  notes: ""
};

const statusMap = {
  active: ["Em Andamento", "default"],
  returned: ["Devolvido", "success"],
  overdue: ["Atrasado", "warning"]
};

const LoansPage = () => {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loans = useAsyncData(() => loansApi.list(search), [search]);
  const lookups = useAsyncData(async () => {
    const [boxes, rooms] = await Promise.all([lookupApi.boxes(), lookupApi.rooms()]);
    return { boxes, rooms };
  }, []);

  const getBoxName = (boxId) => lookups.data?.boxes.find((box) => box.id === boxId)?.name || boxId;
  const getRoomName = (roomId) => lookups.data?.rooms.find((room) => room.id === roomId)?.name || roomId;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback("");
    setSubmitting(true);

    try {
      if (!form.box_id || !form.room_id || !form.session_class || !form.expected_return_at || !form.responsible_name.trim()) {
        throw new Error("Preencha caixa, responsável, sala, turma e previsão de devolução.");
      }

      await loansApi.create({
        box_id: form.box_id,
        responsible_name: form.responsible_name.trim(),
        room_id: form.room_id,
        session_class: form.session_class.trim(),
        expected_return_at: new Date(form.expected_return_at).toISOString(),
        notes: form.notes.trim() || null,
        status: "active"
      });

      setFeedback("Empréstimo registrado com sucesso.");
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Empréstimos</h1>
        <Button onClick={() => setShowForm((current) => !current)}>
          <Icon name="plus" className="mr-2" />
          {showForm ? "Fechar" : "Novo Empréstimo"}
        </Button>
      </div>

      {showForm ? (
        <Card>
          <form className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit}>
            <FormField label="Caixa">
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
            <FormField label="Local / Turma">
              <Select name="room_id" value={form.room_id} onChange={handleChange}>
                <option value="">Selecione</option>
                {lookups.data?.rooms.map((room) => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Disciplina / Turma">
              <Input name="session_class" value={form.session_class} onChange={handleChange} />
            </FormField>
            <FormField label="Previsão de devolução">
              <Input name="expected_return_at" type="datetime-local" value={form.expected_return_at} onChange={handleChange} />
            </FormField>
            <FormField label="Observações">
              <Input name="notes" value={form.notes} onChange={handleChange} />
            </FormField>
            {feedback ? <div className="md:col-span-2"><InlineMessage tone={feedback.includes("sucesso") ? "success" : "error"}>{feedback}</InlineMessage></div> : null}
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Salvar empréstimo"}</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        <div className="p-4 border-b bg-muted/20 flex gap-2 items-center">
          <Input placeholder="Buscar empréstimo..." className="max-w-sm" value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="flex items-center gap-2">
            <Badge variant="outline">Ativos</Badge>
            <Badge variant="outline">Devolvidos</Badge>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loans.loading ? <div className="p-4"><LoadingState /></div> : null}
          {loans.error ? <div className="p-4"><InlineMessage tone="error">{loans.error}</InlineMessage></div> : null}
          {!loans.loading && !loans.error && loans.data?.length === 0 ? (
            <EmptyState title="Nenhum empréstimo encontrado" description="Cadastre um empréstimo para acompanhar as caixas em uso." />
          ) : null}
          {loans.data?.length ? (
            <table>
              <thead>
                <tr>
                  <th>Caixa</th>
                  <th>Professor</th>
                  <th>Local/Turma</th>
                  <th>Retirada</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loans.data.map((loan) => (
                  <tr key={loan.id} className="hover:bg-muted/50">
                    <td className="font-medium">{getBoxName(loan.box_id)}</td>
                    <td>{loan.responsible_name}</td>
                    <td className="text-muted-foreground">{getRoomName(loan.room_id)} / {loan.session_class}</td>
                    <td>{formatDateTime(loan.borrowed_at)}</td>
                    <td>
                      <Badge variant={statusMap[loan.status]?.[1] || "outline"}>
                        {statusMap[loan.status]?.[0] || loan.status}
                      </Badge>
                    </td>
                    <td>
                      {loan.status !== "returned" ? (
                        <Button size="sm" onClick={() => handleReturn(loan)}>Devolver</Button>
                      ) : (
                        <Button variant="ghost" size="sm">Ver Recibo</Button>
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
