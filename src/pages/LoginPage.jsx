import { useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button, Card, FormField, InlineMessage, Input } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";

const initialForm = {
  email: "",
  password: ""
};

const LoginPage = () => {
  const { isAdmin, loading, signInAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const destination = useMemo(() => location.state?.from?.pathname || "/app/dashboard", [location.state]);

  if (!loading && isAdmin) {
    return <Navigate to={destination} replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (!form.email || !form.password) {
        throw new Error("Preencha email e senha.");
      }

      const { error: signInError } = await signInAdmin(form.email, form.password);
      if (signInError) {
        throw signInError;
      }

      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || "Não foi possível autenticar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-muted">
      <Card className="p-8 w-96 text-center space-y-6">
        <div>
          <h1 className="text-2xl font-bold">EquipControl</h1>
          <p className="text-sm text-muted-foreground">Acesso administrativo via Supabase Auth.</p>
        </div>

        <form className="space-y-4 text-left" onSubmit={handleSubmit}>
          <FormField label="Email">
            <Input name="email" type="email" value={form.email} onChange={handleChange} />
          </FormField>

          <FormField label="Senha">
            <Input name="password" type="password" value={form.password} onChange={handleChange} />
          </FormField>

          {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}

          <Button className="w-full" disabled={submitting} type="submit">
            {submitting ? "Processando..." : "Entrar como Admin"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default LoginPage;
