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
<<<<<<< Updated upstream
  const [message, setMessage] = React.useState('Loading listings...');
  const [busyId, setBusyId] = React.useState(null);

  // load listings once when the page opens
=======
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
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
        setMessage('');
=======
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
      // make a new list with the sold item updated
      const updatedListings = [];
      for (const listing of listings)
      {
        if (listing.id === item.id)
        {
          updatedListings.push(data);
        }
        else
        {
          updatedListings.push(listing);
        }
      }
      setListings(updatedListings);
      setMessage('Item marked as sold.');
=======
      setLoading(true);
      setListingsVersion((version) => version + 1);
      setMessage('Item marked as sold. You can leave a review below.');
      setReviewItem(data);
      setReviewRating(0);
      setHoveredRating(0);
      setReviewFeedback('');
      setReviewError('');
>>>>>>> Stashed changes
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

  function updateItem(item)
  {
    window.location.href = `/new-listing?id=${item.id}`;
  }

  // search within the listings returned by the category and price filters
  const keyword = search.trim().toLowerCase();
<<<<<<< Updated upstream
  for (const item of listings)
  {
    const text = (item.title + ' ' + item.description).toLowerCase();
    const matchesSearch = text.includes(keyword);
    const matchesCategory = category === '' || item.category === category;
    if (matchesSearch && matchesCategory)
    {
      filteredListings.push(item);
    }
  }
=======
  const filteredListings = listings.filter((item) =>
    (item.title + ' ' + item.description).toLowerCase().includes(keyword)
  );
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
        </div>
        <button className="buy-button" type="button" disabled={item.sold || busyId !== null} onClick={() => buyItem(item)}>{buyButtonText}</button>
        <div className="item-actions">
          <button className="delete-button" type="button" disabled={busyId !== null} onClick={() => deleteItem(item)}>Delete</button>
          <button className="update-button" type="button" disabled={busyId !== null} onClick={() => updateItem(item)}>Update</button>
        </div>
=======
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
>>>>>>> Stashed changes
      </div>
    );
  }

  return (
    <main>
      <section className="welcome">
        <h1>Welcome to NAU Market</h1>
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
<<<<<<< Updated upstream
=======
        <div>
          <label htmlFor="pricing">Pricing</label>
          <select id="pricing" value={pricing} onChange={(event) => setPricing(event.target.value)}>
            <option value="">All Prices</option>
            {Object.keys(priceRanges).map((range) => <option key={range}>{range}</option>)}
          </select>
        </div>
>>>>>>> Stashed changes
      </div>

      <h2>Listings</h2>
      <p role="status">{displayMessage}</p>
      <div className="item-list">
        {!loading && filteredListings.map(showListing)}
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Homepage />);
