const priceRanges = {
  'Under $10': { maxPrice: '9.99' },
  '$10 - $50': { minPrice: '10', maxPrice: '50' },
  '$50 - $100': { minPrice: '50.01', maxPrice: '100' },
  'Over $100': { minPrice: '100.01' }
};

function Homepage()
{
  const [listings, setListings] = React.useState([]);
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [pricing, setPricing] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');
  const [listingsVersion, setListingsVersion] = React.useState(0);
  const [busyId, setBusyId] = React.useState(null);
  const [reviewItem, setReviewItem] = React.useState(null);
  const [reviewRating, setReviewRating] = React.useState(0);
  const [hoveredRating, setHoveredRating] = React.useState(0);
  const [reviewFeedback, setReviewFeedback] = React.useState('');
  const [reviewError, setReviewError] = React.useState('');
  const [reviewBusy, setReviewBusy] = React.useState(false);
  // ask the server for listings whenever a filter or listing changes
  React.useEffect(() =>
  {
    const controller = new AbortController();
    const query = new URLSearchParams({ active: 'true', ...priceRanges[pricing] });
    if (category)
    {
      query.set('category', category);
    }
    setLoading(true);
    setLoadError('');

    async function loadListings()
    {
      try
      {
        const response = await fetch(`/api/listings?${query}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok)
        {
          throw new Error(data.error);
        }
        setListings(data);
      }
      catch (error)
      {
        if (!controller.signal.aborted)
        {
          setListings([]);
          setLoadError('Could not load listings. Please try again later.');
        }
      }
      finally
      {
        if (!controller.signal.aborted)
        {
          setLoading(false);
        }
      }
    }
    loadListings();
    return () => controller.abort();
  }, [category, pricing, listingsVersion]);

  async function buyItem(item)
  {
    if (document.getElementById('root').dataset.signedIn !== 'true')
    {
      window.location.href = '/signin';
      return;
    }
    if (!window.confirm(`Mark "${item.title}" as sold?`))
    {
      return;
    }
    setBusyId(item.id);
    try
    {
      const response = await fetch(`/api/listings/${item.id}/buy`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok)
      {
        throw new Error(data.error);
      }
      setLoading(true);
      setListingsVersion((version) => version + 1);
      setMessage('Item marked as sold. You can leave a review below.');
      setReviewItem(data);
      setReviewRating(0);
      setHoveredRating(0);
      setReviewFeedback('');
      setReviewError('');
    }
    catch (error)
    {
      setMessage(error.message);
    }
    finally
    {
      setBusyId(null);
    }
  }
  async function deleteItem(item)
  {
    if (!window.confirm(`Delete "${item.title}"?`))
    {
      return;
    }
    setBusyId(item.id);
    try
    {
      const response = await fetch(`/api/listings/${item.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok)
      {
        throw new Error(data.error);
      }
      setLoading(true);
      setListingsVersion((version) => version + 1);
      setMessage('Listing deleted.');
    }
    catch (error)
    {
      setMessage(error.message);
    }
    finally
    {
      setBusyId(null);
    }
  }

  async function submitReview(event)
  {
    event.preventDefault();
    if (!reviewItem)
    {
      return;
    }
    setReviewError('');
    setReviewBusy(true);
    try
    {
      const response = await fetch(`/api/transactions/${reviewItem.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: reviewRating, feedback: reviewFeedback })
      });
      const data = await response.json();
      if (!response.ok)
      {
        throw new Error(data.error);
      }
      setReviewItem(null);
      setMessage('Thanks for sharing your review.');
    }
    catch (error)
    {
      setReviewError(error.message);
    }
    finally
    {
      setReviewBusy(false);
    }
  }

  function closeReview()
  {
    setReviewItem(null);
    setReviewError('');
  }

  function updateItem(item)
  {
    window.location.href = `/new-listing?id=${item.id}`;
  }

  // search within the listings returned by the category and price filters
  const keyword = search.trim().toLowerCase();
  const filteredListings = listings.filter((item) =>
    (item.title + ' ' + item.description).toLowerCase().includes(keyword)
  );

  let displayMessage = loadError || message;
  if (!displayMessage)
  {
    if (loading)
    {
      displayMessage = 'Loading listings...';
    }
    else if (filteredListings.length === 0)
    {
      displayMessage = 'No listings found.';
    }
  }

  // show one card for each item
  function showListing(item)
  {
    let buyButtonText;
    if (item.sold)
    {
      buyButtonText = 'Sold';
    }
    else
    {
      buyButtonText = 'Buy';
    }

    return (
      <div className="item-card" key={item.id}>
        <img src={item.image} alt={item.title} />
        <p className="item-price">${Number(item.price).toFixed(2)}</p>
        <h3>{item.title}</h3>
        <p className="item-description">{item.description}</p>
        <div className="item-info">
          <span>{item.category}</span>
          <span>Seller: {item.user ? <a href={`/profile?user=${encodeURIComponent(item.user)}`}>{item.user}</a> : 'Unknown'}</span>
        </div>
        <button className="buy-button" type="button" disabled={item.sold || busyId !== null} onClick={() => buyItem(item)}>{buyButtonText}</button>
        {item.canEdit && (
          <div className="item-actions">
            <button className="delete-button" type="button" disabled={busyId !== null} onClick={() => deleteItem(item)}>Delete</button>
            <button className="update-button" type="button" disabled={busyId !== null} onClick={() => updateItem(item)}>Update</button>
          </div>
        )}
        <a className="comments-button" href={`/listings/${item.id}/comments`}>Comments</a>
      </div>
    );
  }

  return (
    <main>
      <section className="welcome">
        <h1>Welcome to NAU Market </h1>
        <p>Browse items or create a listing to sell something.</p>
      </section>
      <div className="filters">
        <div>
          <label htmlFor="search">Search</label>
          <input id="search" type="search" placeholder="Search for an item" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div>
          <label htmlFor="category">Category</label>
          <select id="category" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All Categories</option>
            <option>Books</option>
            <option>Electronics</option>
            <option>Furniture</option>
            <option>Clothing</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="pricing">Pricing</label>
          <select id="pricing" value={pricing} onChange={(event) => setPricing(event.target.value)}>
            <option value="">All Prices</option>
            {Object.keys(priceRanges).map((range) => <option key={range}>{range}</option>)}
          </select>
        </div>
      </div>

      <h2>Listings</h2>
      <p role="status">{displayMessage}</p>
      <div className="item-list">
        {!loading && filteredListings.map(showListing)}
      </div>
      {reviewItem && (
        <div className="review-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget)
          {
            closeReview();
          }
        }}>
          <section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-title" aria-describedby="review-description">
            <button className="review-close" type="button" aria-label="Close review form" onClick={closeReview}>×</button>
            <h2 id="review-title">How was your purchase?</h2>
            <p id="review-description">Share your experience with <strong>{reviewItem.title}</strong>.</p>
            <form onSubmit={submitReview}>
              <fieldset className="rating-fieldset">
                <legend>Your rating</legend>
                <div className="rating-stars" role="group" aria-label="Choose a rating from 0.5 to 5 stars" onMouseLeave={() => setHoveredRating(0)}>
                  {Array.from({ length: 10 }, (_, index) => {
                    const value = (index + 1) / 2;
                    const isLeftHalf = index % 2 === 0;
                    const displayedRating = hoveredRating || reviewRating;
                    const isActive = value <= displayedRating;
                    return (
                      <button
                        key={value}
                        className={`rating-star-half ${isActive ? 'is-active' : ''} ${isLeftHalf ? 'left-half' : 'right-half'}`}
                        type="button"
                        aria-label={`${value} out of 5 stars`}
                        aria-pressed={reviewRating === value}
                        onMouseEnter={() => setHoveredRating(value)}
                        onFocus={() => setHoveredRating(value)}
                        onBlur={() => setHoveredRating(0)}
                        onClick={() => setReviewRating(value)}
                      />
                    );
                  })}
                </div>
                <p className="rating-hint">{hoveredRating || reviewRating ? `${hoveredRating || reviewRating} out of 5 stars` : 'Select a star rating'}</p>
              </fieldset>
              <label htmlFor="review-feedback">Written feedback</label>
              <textarea
                id="review-feedback"
                rows="4"
                maxLength="1000"
                placeholder="What did you think about your purchase?"
                value={reviewFeedback}
                onChange={(event) => setReviewFeedback(event.target.value)}
                required
              />
              <p className="review-character-count">{reviewFeedback.length}/1000 characters</p>
              {reviewError && <p className="review-error" role="alert">{reviewError}</p>}
              <div className="review-actions">
                <button type="button" className="review-skip" onClick={closeReview} disabled={reviewBusy}>Maybe later</button>
                <button type="submit" disabled={reviewBusy || reviewRating === 0 || !reviewFeedback.trim()}>
                  {reviewBusy ? 'Submitting...' : 'Submit review'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Homepage />);
