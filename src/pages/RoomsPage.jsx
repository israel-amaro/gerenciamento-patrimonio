import { useState } from "react";
import { Button, Card, EmptyState, FormField, Icon, InlineMessage, Input, LoadingState, Select, Textarea } from "../components/ui";
import { useAsyncData } from "../hooks/useAsyncData";
import { roomsApi } from "../lib/api";

const createInitialForm = () => ({
  id: "",
  name: "",
  building: "",
  floor: "",
  room_type: "classroom",
  description: "",
  is_active: true
});

const roomTypeOptions = [
  { value: "classroom", label: "Sala" },
  { value: "auditorium", label: "Auditorio" },
  { value: "support", label: "Apoio" },
  { value: "other", label: "Outro" }
];

const RoomsPage = () => {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(createInitialForm);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const rooms = useAsyncData(() => roomsApi.list(search), [search]);

  const reset = () => {
    setForm(createInitialForm());
    setIsEditing(false);
    setShowForm(false);
    setFeedback("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === "is_active" ? value === "true" : value
    }));
  };

  const handleEdit = (room) => {
    setForm({
      id: room.id,
      name: room.name || "",
      building: room.building || "",
      floor: room.floor || "",
      room_type: room.room_type || "classroom",
      description: room.description || "",
      is_active: room.is_active !== false
    });
    setIsEditing(true);
    setShowForm(true);
    setFeedback("");
  };

  const handleCreate = () => {
    setForm(createInitialForm());
    setIsEditing(false);
    setShowForm(true);
    setFeedback("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback("");
    setSubmitting(true);

    try {
      if (!form.name.trim()) {
        throw new Error("Informe o nome da sala.");
      }

      const payload = {
        name: form.name.trim(),
        building: form.building.trim() || null,
        floor: form.floor.trim() || null,
        room_type: form.room_type || "classroom",
        description: form.description.trim() || null,
        is_active: form.is_active
      };

      if (isEditing) {
        await roomsApi.update(form.id, payload);
      } else {
        await roomsApi.create(payload);
      }

      reset();
      await rooms.reload();
    } catch (err) {
      setFeedback(err.message || "Nao foi possivel salvar a sala.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (room) => {
    try {
      await roomsApi.update(room.id, { is_active: room.is_active === false });
      await rooms.reload();
    } catch (err) {
      setFeedback(err.message || "Nao foi possivel atualizar o status da sala.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Salas</h1>
        <Button onClick={() => (showForm ? reset() : handleCreate())}>
          <Icon name="plus" className="mr-2" />
          {showForm ? "Fechar" : "Nova sala"}
        </Button>
      </div>

      {showForm ? (
        <Card>
          <form className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2" onSubmit={handleSubmit}>
            <FormField label="Nome">
              <Input name="name" value={form.name} onChange={handleChange} />
            </FormField>
            <FormField label="Bloco">
              <Input name="building" value={form.building} onChange={handleChange} />
            </FormField>
            <FormField label="Andar">
              <Input name="floor" value={form.floor} onChange={handleChange} />
            </FormField>
            <FormField label="Tipo">
              <Select name="room_type" value={form.room_type} onChange={handleChange}>
                {roomTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Descricao">
                <Textarea name="description" value={form.description} onChange={handleChange} />
              </FormField>
            </div>
            <FormField label="Status">
              <Select name="is_active" value={String(form.is_active)} onChange={handleChange}>
                <option value="true">Ativa</option>
                <option value="false">Inativa</option>
              </Select>
            </FormField>
            {feedback ? <div className="md:col-span-2"><InlineMessage tone="error">{feedback}</InlineMessage></div> : null}
            <div className="flex justify-end gap-2 md:col-span-2">
              <Button type="button" variant="outline" onClick={reset}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : isEditing ? "Salvar alteracoes" : "Salvar sala"}</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        <div className="border-b bg-muted/20 p-4">
          <Input placeholder="Buscar sala..." className="max-w-sm" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="overflow-x-auto">
          {rooms.loading ? <div className="p-4"><LoadingState /></div> : null}
          {rooms.error ? <div className="p-4"><InlineMessage tone="error">{rooms.error}</InlineMessage></div> : null}
          {!rooms.loading && !rooms.error && rooms.data?.length === 0 ? (
            <EmptyState title="Nenhuma sala cadastrada" description="Cadastre salas para disponibilizar os locais de emprestimo." />
          ) : null}
          {rooms.data?.length ? (
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Bloco</th>
                  <th>Andar</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {rooms.data.map((room) => (
                  <tr key={room.id} className="hover:bg-muted/50">
                    <td className="font-medium">
                      <div>{room.name}</div>
                      <div className="text-sm text-muted-foreground">{room.description || "-"}</div>
                    </td>
                    <td>{room.building || "-"}</td>
                    <td>{room.floor || "-"}</td>
                    <td>{roomTypeOptions.find((option) => option.value === room.room_type)?.label || "Sala"}</td>
                    <td>{room.is_active === false ? "Inativa" : "Ativa"}</td>
                    <td className="space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(room)}>Editar</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(room)}>
                        {room.is_active === false ? "Ativar" : "Inativar"}
                      </Button>
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

export default RoomsPage;
