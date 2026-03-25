const { useState } = React;
const {
  useNavigate,
  Navigate
} = ReactRouterDOM;

const Login = () => {
  const nav = useNavigate();

  return (
    <div className="flex h-screen items-center justify-center bg-muted">
      <div className="p-8 bg-card border rounded-lg shadow-sm w-96 text-center space-y-6">
        <h1 className="text-2xl font-bold">EquipControl</h1>
        <p className="text-sm text-muted-foreground">Autenticação (Modo CDN Exemplo)</p>
        <Button className="w-full" onClick={() => nav("/app/dashboard")}>
          Entrar no Sistema
        </Button>
      </div>
    </div>
  );
};

const Dashboard = () => (
  <div className="space-y-6">
    <h1 className="text-2xl font-bold tracking-tight">Dashboard Institucional</h1>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Total de Ativos</CardTitle>
          <i data-lucide="laptop" className="text-muted-foreground"></i>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">1,492</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Caixas Emprestadas</CardTitle>
          <i data-lucide="package" className="text-muted-foreground"></i>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">14</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Defeitos Abertos</CardTitle>
          <i data-lucide="alert-triangle" className="text-red-500"></i>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">8</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Auditorias OK</CardTitle>
          <i data-lucide="check-circle" className="text-green-500"></i>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">92%</div>
        </CardContent>
      </Card>
    </div>
  </div>
);

const Assets = () => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <h1 className="text-2xl font-bold tracking-tight">Ativos</h1>
      <Button>
        <i data-lucide="plus" className="mr-2"></i>
        Novo Ativo
      </Button>
    </div>

    <Card>
      <div className="p-4 border-b bg-muted/20 relative">
        <i data-lucide="search" className="absolute left-7 top-7 text-muted-foreground w-4 h-4"></i>
        <Input placeholder="Buscar por tag ou serial..." className="pl-9 max-w-sm" />
      </div>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Patrimônio / Tag</th>
              <th>Modelo</th>
              <th>Localização</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className="hover:bg-muted/50">
                <td className="font-medium">N-00{i}</td>
                <td>Dell Latitude 3420</td>
                <td className="text-muted-foreground">Caixa 01 - Dell</td>
                <td>
                  <Badge variant={i % 3 === 0 ? "warning" : "success"}>
                    {i % 3 === 0 ? "Manutenção" : "Disponível"}
                  </Badge>
                </td>
                <td>
                  <Button variant="ghost" size="sm">Editar</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  </div>
);

const Boxes = () => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <h1 className="text-2xl font-bold tracking-tight">Caixas (Lotes)</h1>
      <Button>
        <i data-lucide="plus" className="mr-2"></i>
        Nova Caixa
      </Button>
    </div>

    <Card>
      <div className="p-4 border-b bg-muted/20">
        <Input placeholder="Buscar caixa..." className="max-w-sm" />
      </div>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Nome da Caixa</th>
              <th>Qtd. Ativos</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map((i) => (
              <tr key={i} className="hover:bg-muted/50">
                <td className="font-medium">Caixa 0{i} - Dell</td>
                <td>40 Notebooks</td>
                <td>
                  <Badge variant={i > 2 ? "default" : "success"}>
                    {i > 2 ? "Emprestada" : "Disponível"}
                  </Badge>
                </td>
                <td>
                  <Button variant="ghost" size="sm">Detalhes</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  </div>
);

const Loans = () => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <h1 className="text-2xl font-bold tracking-tight">Empréstimos</h1>
      <Button>
        <i data-lucide="plus" className="mr-2"></i>
        Novo Empréstimo
      </Button>
    </div>

    <Card>
      <div className="p-4 border-b bg-muted/20 flex gap-2">
        <Input placeholder="Buscar empréstimo..." className="max-w-sm" />
        <div className="flex items-center gap-2">
          <Badge variant="outline">Ativos</Badge>
          <Badge variant="outline">Devolvidos</Badge>
        </div>
      </div>

      <div className="overflow-x-auto">
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
            {[1, 2, 3, 4].map((i) => (
              <tr key={i} className="hover:bg-muted/50">
                <td className="font-medium">Caixa 0{i} - Dell</td>
                <td>Prof. {["João", "Maria", "Pedro", "Ana"][i - 1]}</td>
                <td className="text-muted-foreground">Sala 10{i}</td>
                <td>Hoje, 08:00</td>
                <td>
                  <Badge variant={i === 1 ? "success" : "default"}>
                    {i === 1 ? "Devolvido" : "Em Andamento"}
                  </Badge>
                </td>
                <td>
                  {i !== 1 ? (
                    <Button size="sm">Devolver</Button>
                  ) : (
                    <Button variant="ghost" size="sm">Ver Recibo</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  </div>
);

const Checklists = () => {
  const [view, setView] = useState("form");

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Checklist de Laboratório</h1>
      <p className="text-muted-foreground">
        Registro rápido no início/fim da aula por professores.
      </p>

      {view === "form" ? (
        <Card>
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="text-lg">Nova Auto-inspeção</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Laboratório</label>
                <Select>
                  <option>Lab 01</option>
                  <option>Lab 02</option>
                  <option>Lab Maker</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Disciplina</label>
                <Input placeholder="Ex: Algoritmos" />
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-4">Condição Geral do Lab:</p>
              <div className="grid grid-cols-2 gap-4">
                <div
                  onClick={() => setView("success")}
                  className="border rounded-md p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-green-50 border-green-200 transition-colors"
                >
                  <i data-lucide="check-circle" className="text-green-500 w-8 h-8 mb-2"></i>
                  <div className="font-bold text-green-700">Tudo OK</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Nenhum problema encontrado
                  </div>
                </div>

                <div
                  onClick={() => setView("success")}
                  className="border rounded-md p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-red-50 border-red-200 transition-colors"
                >
                  <i data-lucide="alert-triangle" className="text-red-500 w-8 h-8 mb-2"></i>
                  <div className="font-bold text-red-700">Reportar Problema</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Falta hardware, avaria, etc.
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-8 text-center">
            <i data-lucide="check-circle" className="text-green-500 w-12 h-12 mx-auto mb-4"></i>
            <div className="text-xl text-green-700 font-bold mb-4">Checklist Salvo!</div>
            <Button onClick={() => setView("form")}>Fazer outro</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const Audits = () => (
  <div className="space-y-6 max-w-4xl mx-auto">
    <h1 className="text-2xl font-bold tracking-tight">Auditoria Técnica com QR Code</h1>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="border-b bg-muted/20 flex flex-row items-center gap-2">
          <i data-lucide="scan-line" className="text-primary mt-1"></i>
          <CardTitle>Scanner</CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center flex flex-col items-center gap-4">
          <div className="h-24 w-24 bg-muted rounded-full flex items-center justify-center border-4 border-dashed border-muted-foreground">
            <i data-lucide="qr-code" className="w-10 h-10 text-muted-foreground"></i>
          </div>
          <p className="text-sm text-muted-foreground">
            Abra este app no celular para escanear a etiqueta do equipamento diretamente.
          </p>
          <Button className="w-full">Abrir Câmera</Button>
          <div className="flex w-full items-center gap-2 pt-4 border-t">
            <Input placeholder="Ou digite a TAG..." />
            <Button variant="secondary">OK</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="opacity-50 pointer-events-none">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle>Inspeção N-001</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="text-sm">Aguardando escaneamento...</div>
        </CardContent>
      </Card>
    </div>
  </div>
);

const Incidents = () => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <h1 className="text-2xl font-bold tracking-tight">Defeitos / Incidentes</h1>
      <Button variant="destructive">
        <i data-lucide="alert-triangle" className="mr-2 h-4 w-4"></i>
        Abrir Ticket
      </Button>
    </div>

    <Card>
      <div className="p-4 border-b bg-muted/20">
        <Input placeholder="Buscar incidente..." className="max-w-sm" />
      </div>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Ativo</th>
              <th>Problema</th>
              <th>Severidade</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map((i) => (
              <tr key={i} className="hover:bg-muted/50">
                <td className="font-medium">INC-{i}</td>
                <td>N-00{i}</td>
                <td className="truncate max-w-[200px]">Não liga na tomada</td>
                <td>
                  <Badge variant={i % 2 === 0 ? "destructive" : "warning"}>
                    {i % 2 === 0 ? "Crítico" : "Moderado"}
                  </Badge>
                </td>
                <td>
                  <Badge variant="outline">{i === 1 ? "Resolvido" : "Aberto"}</Badge>
                </td>
                <td>
                  <Button variant="ghost" size="sm">Tratar</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  </div>
);

const Reports = () => (
  <div className="space-y-6">
    <h1 className="text-2xl font-bold tracking-tight">Relatórios & QR Print</h1>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Exportação de Ativos</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline">
            <i data-lucide="download" className="mr-2"></i>
            CSV de Inventário
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Impressão de QR Codes</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline">
            <i data-lucide="printer" className="mr-2"></i>
            Gerar PDF das Etiquetas Lote 01
          </Button>
        </CardContent>
      </Card>
    </div>
  </div>
);