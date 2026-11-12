function Signup()
{
  const [message, setMessage] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(event)
  {
    event.preventDefault();
    const fields = event.target.elements;

    if (!fields.name.value.trim())
    {
      setMessage('Please enter your name.');
      return;
    }
    if (fields.password.value !== fields.confirmPassword.value)
    {
      setMessage('Passwords must match.');
      return;
    }
    const account = {
      user_id: fields.user_id.value,
      name: fields.name.value,
      email: fields.email.value,
      password: fields.password.value
    };
    setSaving(true);
    setMessage('');
    try
    {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(account)
      });
      const data = await response.json();
      if (!response.ok)
      {
        throw new Error(data.error);
      }
      window.location.href = '/signin';
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
    buttonText = 'Creating Account...';
  }
  else
  {
    buttonText = 'Sign Up';
  }

  return (
    <main className="form-page">
      <h1>Sign Up</h1>
      <p className="intro">Fill in your details to get started.</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="user_id">User ID</label>
        <input id="user_id" name="user_id" autoComplete="username" maxLength="50" required />

        <label htmlFor="name">Name</label>
        <input id="name" name="name" autoComplete="name" maxLength="100" required />

        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" maxLength="254" required />

        <label htmlFor="password">Password (at least 8 characters)</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength="8" maxLength="128" required />

        <label htmlFor="confirm-password">Confirm Password</label>
        <input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength="8" maxLength="128" required />

        <button type="submit" disabled={saving}>{buttonText}</button>
        <p role="status">{message}</p>
      </form>
      <p>Already have an account? <a href="/signin">Sign In</a></p>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Signup />);
