function NewListing()
{
  const id = new URLSearchParams(window.location.search).get('id');
  const [item, setItem] = React.useState(null);
  const [loading, setLoading] = React.useState(Boolean(id));
  const [message, setMessage] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  // when updating, load the existing item before showing the form
  React.useEffect(() =>
  {
    if (!id)
    {
      return;
    }
    async function loadItem()
    {
      try
      {
        const response = await fetch(`/api/listings/${id}`);
        const data = await response.json();
        if (!response.ok)
        {
          throw new Error(data.error);
        }
        setItem(data);
      }
      catch (error)
      {
        setMessage(error.message);
      }
      finally
      {
        setLoading(false);
      }
    }
    loadItem();
  }, [id]);

  async function saveListing(listing)
  {
    try
    {
      let url;
      let method;
      if (id)
      {
        url = `/api/listings/${id}`;
        method = 'PUT';
      }
      else
      {
        url = '/api/listings';
        method = 'POST';
      }
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listing)
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

  function handleSubmit(event)
  {
    event.preventDefault();
    const fields = event.target.elements;
    const photo = fields.image.files[0];

    if (!photo && !item)
    {
      setMessage('Choose a photo.');
      return;
    }
    if (photo && !['image/jpeg', 'image/png', 'image/webp'].includes(photo.type))
    {
      setMessage('Choose a JPG, PNG, or WebP photo.');
      return;
    }
    if (photo && photo.size > 1024 * 1024)
    {
      setMessage('Choose a photo that is 1 MB or smaller.');
      return;
    }

    let currentImage;
    if (item)
    {
      currentImage = item.image;
    }
    else
    {
      currentImage = '';
    }

    const listing = {
      title: fields.title.value,
      description: fields.description.value,
      price: fields.price.value,
      category: fields.category.value,
      image: currentImage
    };
    setSaving(true);
    setMessage('');

    // keep the current photo unless a replacement was selected
    if (!photo)
    {
      saveListing(listing);
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
    {
      listing.image = reader.result;
      saveListing(listing);
    };
    reader.onerror = () =>
    {
      setMessage('Could not read the photo. Please try another one.');
      setSaving(false);
    };
    reader.readAsDataURL(photo);
  }

  if (loading)
  {
    return <main><p role="status">Loading listing...</p></main>;
  }
  if (id && !item)
  {
    return <main><p role="alert">{message}</p><a href="/">Back To Listings</a></main>;
  }

  let pageTitle;
  let intro;
  let photoLabel;
  let photoRequired;
  let buttonText;
  if (id)
  {
    pageTitle = 'Update Listing';
    intro = 'Edit the details below and save your changes.';
    photoLabel = 'Replace Photo (Optional)';
    photoRequired = false;
  }
  else
  {
    pageTitle = 'New Listing';
    intro = 'Add a few details about the item you want to sell.';
    photoLabel = 'Photo';
    photoRequired = true;
  }

  if (saving)
  {
    buttonText = 'Saving...';
  }
  else if (id)
  {
    buttonText = 'Save Changes';
  }
  else
  {
    buttonText = 'Post Listing';
  }

  // start with empty fields, or use the existing item when editing
  let formValues = { title: '', description: '', price: '', category: '' };
  let photoPreview = null;
  if (item)
  {
    formValues = item;
    photoPreview = <img className="photo-preview" src={item.image} alt="Current listing photo" />;
  }

  return (
    <main className="form-page">
      <h1>{pageTitle}</h1>
      <p className="intro">{intro}</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="title">Title</label>
        <input id="title" name="title" defaultValue={formValues.title} maxLength="100" required />

        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" defaultValue={formValues.description} rows="4" maxLength="2000" required />

        <label htmlFor="price">Price ($)</label>
        <input id="price" name="price" type="number" defaultValue={formValues.price} min="0" max="999999.99" step="0.01" required />

        <label htmlFor="category">Category</label>
        <select id="category" name="category" defaultValue={formValues.category} required>
          <option value="" disabled>Choose a category</option>
          <option>Books</option>
          <option>Electronics</option>
          <option>Furniture</option>
          <option>Clothing</option>
          <option>Other</option>
        </select>

        {photoPreview}
        <label htmlFor="image">{photoLabel} (JPG, PNG, or WebP, up to 1 MB)</label>
        <input id="image" name="image" type="file" accept="image/jpeg,image/png,image/webp" required={photoRequired} />

        <button type="submit" disabled={saving}>{buttonText}</button>
        <p role="status">{message}</p>
      </form>
      <a href="/">Cancel</a>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<NewListing />);
