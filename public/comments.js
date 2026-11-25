function ListingComments()
{
  const listingId = document.getElementById('root').dataset.listingId;
  const [listing, setListing] = React.useState(null);
  const [comments, setComments] = React.useState([]);
  const [canComment, setCanComment] = React.useState(false);
  const [commentText, setCommentText] = React.useState('');
  const [message, setMessage] = React.useState('Loading comments...');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() =>
  {
    async function loadComments()
    {
      try
      {
        const response = await fetch(`/api/listings/${listingId}/comments`);
        const data = await response.json();
        if (!response.ok)
        {
          throw new Error(data.error);
        }
        setListing(data.listing);
        setComments(data.comments);
        setCanComment(data.canComment);
        setMessage('');
      }
      catch (loadError)
      {
        setError(loadError.message || 'Could not load comments for this listing.');
        setMessage('');
      }
    }
    loadComments();
  }, [listingId]);

  async function submitComment(event)
  {
    event.preventDefault();
    setError('');
    setBusy(true);
    try
    {
      const response = await fetch(`/api/listings/${listingId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commentText })
      });
      const data = await response.json();
      if (!response.ok)
      {
        throw new Error(data.error);
      }
      setComments((currentComments) => [...currentComments, data.comment]);
      setCommentText('');
      setMessage('Comment posted.');
    }
    catch (submitError)
    {
      setError(submitError.message || 'Could not post your comment.');
    }
    finally
    {
      setBusy(false);
    }
  }

  return (
    <main className="comments-page">
      <a href="/">← Back to listings</a>
      {error && <p className="comments-error" role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {listing && (
        <>
          <section className="comments-heading">
            <h1>Comments</h1>
            <p>Discussion for <strong>{listing.title}</strong></p>
          </section>
          {canComment ? (
            <form className="comments-form" onSubmit={submitComment}>
              <label htmlFor="comment-text">Add a comment</label>
              <textarea
                id="comment-text"
                rows="4"
                maxLength="2000"
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder="Share a question or comment about this listing"
                required
              />
              <p className="comment-character-count">{commentText.length}/2000 characters</p>
              <button type="submit" disabled={busy || !commentText.trim()}>
                {busy ? 'Posting...' : 'Post comment'}
              </button>
            </form>
          ) : (
            <p className="comments-signin">
              <a href="/signin">Sign in</a> to join the discussion.
            </p>
          )}
          <section aria-labelledby="comment-list-title">
            <h2 id="comment-list-title">Discussion ({comments.length})</h2>
            {comments.length === 0 ? (
              <p>No comments yet. Start the discussion.</p>
            ) : (
              <div className="comment-list">
                {comments.map((comment) => (
                  <article className="comment-card" key={comment.id}>
                    <header>
                      <strong>{comment.author}</strong>
                      <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}</time>
                    </header>
                    <p className="comment-text">{comment.text}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ListingComments />);
