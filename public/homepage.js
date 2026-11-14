function Homepage()
{
  const [listings, setListings] = React.useState([]);
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [message, setMessage] = React.useState('Loading listings...');
  const [busyId, setBusyId] = React.useState(null);

  // load listings once when the page opens
  React.useEffect(() =>
  {
    async function loadListings()
    {
      try
      {
        const response = await fetch('/api/listings');
        const data = await response.json();
        if (!response.ok)
        {
          throw new Error(data.error);
        }
        setListings(data);
        setMessage('');
      }
      catch (error)
      {
        setMessage('Could not load listings. Please try again later.');
      }
    }
    loadListings();
  }, []);

  async function buyItem(item)
  {
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
      // keep every item except the one that was deleted
      const remainingListings = [];
      for (const listing of listings)
      {
        if (listing.id !== item.id)
        {
          remainingListings.push(listing);
        }
      }
      setListings(remainingListings);
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

  // check each item against the search and category
  const filteredListings = [];
  const keyword = search.trim().toLowerCase();
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

  let displayMessage;
  if (message)
  {
    displayMessage = message;
  }
  else if (filteredListings.length === 0)
  {
    displayMessage = 'No listings found.';
  }
  else
  {
    displayMessage = '';
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
        </div>
        <button className="buy-button" type="button" disabled={item.sold || busyId !== null} onClick={() => buyItem(item)}>{buyButtonText}</button>
        <div className="item-actions">
          <button className="delete-button" type="button" disabled={busyId !== null} onClick={() => deleteItem(item)}>Delete</button>
          <button className="update-button" type="button" disabled={busyId !== null} onClick={() => updateItem(item)}>Update</button>
        </div>
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
      </div>

      <h2>Listings</h2>
      <p role="status">{displayMessage}</p>
      <div className="item-list">
        {filteredListings.map(showListing)}
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Homepage />);
