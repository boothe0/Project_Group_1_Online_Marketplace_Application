function Signin()
{
  const [message, setMessage] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(event)
  {
    event.preventDefault();
    const fields = event.target.elements;
    const account = {
      user_id: fields.user_id.value,
      password: fields.password.value
    };
    setSaving(true);
    setMessage('');
    try
    {
      const response = await fetch('/api/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(account)
      });
      const data = await response.json();
      if (!response.ok)
      {
        throw new Error(data.error);
      }
      window.location.href = '/';
    }
    catch (error)
    {
      setMessage(error.message);
      setSaving(false);
    }
  }

  let buttonText;
  if (saving)
  {
    buttonText = 'Signing In...';
  }
  else
  {
    buttonText = 'Sign In';
  }

  return (
    <main className="form-page">
      <h1>Sign In</h1>
      <p className="intro">Enter your account details below.</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="user_id">User ID</label>
        <input id="user_id" name="user_id" autoComplete="username" maxLength="50" required />

        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" minLength="8" maxLength="128" required />

        <button type="submit" disabled={saving}>{buttonText}</button>
        <p role="status">{message}</p>
      </form>
      <p>Need an account? <a href="/signup">Sign Up</a></p>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Signin />);
