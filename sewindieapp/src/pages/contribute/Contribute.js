import React, { useState } from "react";

const Contribute = () => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: '',
        designer: '',
        category: '',
        sizes: '',
        audience: '',
        publicationDate: '',
        unknownDate: false,
        inPrint: false,
        onBlog: false,
        patternLink: '',
        isFree: false,
        isPartOfBundle: false,
        currency: '',
        price: '',
        knit: false,
        woven: false,
        suggestedFabrics: [''],
        requiredNotions: [''],
        yardage: '',
});

const steps = [
    'Name and Designer',
    'Category',
    'Sizes and Audience',
    'Sources',
    'Links & Price',
    'Fabric and Notions'
];
  
const categories = [
    'Coat / Jacket',
    'Dress',
    'Intimate Apparel',
    'Leggings',
    'Onesies / Rompers',
    'Other',
    'Pants / Jeans',
    'Robe',
    'Short',
    'Shrug / Bolero',
    'Skirt',
    'Sleepwear',
    'Sweater',
    'Swimwear',
    'Tops',
    'Vest'
];

const audienceOptions = [
    'Men',
    'Women',
    'Unisex Adult',
    'Children',
    'Baby'
];

const currencies = [
    'USD',
    'EUR',
    'GBP',
    'CAD',
    'AUD',
    'JPY',
    'CNY',
    // Add more currencies as needed
];

const yardageOptions = [
    '0-1',
    '1-2',
    '2-3',
    '3-4',
    '4-5',
    '5+'
];

const nextStep = () => {
    setStep(step + 1);
};

const prevStep = () => {
    if (step > 1) {
        setStep(step - 1);
    }
};

const handleChange = (input) => (e) => {
    setFormData({ ...formData, [input]: e.target.value });
};

const handleArrayChange = (input, index) => (e) => {
    const newArray = [...formData[input]];
    newArray[index] = e.target.value;
    setFormData({ ...formData, [input]: newArray });
};

const handleCheckboxChange = (input) => (e) => {
    setFormData({ ...formData, [input]: e.target.checked });
};

const addArrayField = (input) => () => {
    setFormData({ ...formData, [input]: [...formData[input], ''] });
};

const handleSubmit = () => {
    console.log('Form submitted', formData);
    setStep(7);
};

return (
    <div className="container mt-5">
        <div className="row"><div className="col-12 text-center">
            <h1>Help us expand our pattern database!</h1>
    </div></div>

    <div className="row mt-4"><div className="col-md-3"><nav className="nav flex-column">
        {steps.map((label, index) => (
            <button key={index}className={`nav-link ${step === index + 1 ? 'active' : ''}`}
                onClick={() => setStep(index + 1)}
            >
                {label}
            </button>
))}
    </nav></div><div className="col-md-9">

        {step === 1 && (
            <div><h2>Name & Designer</h2><form><div className="mb-3"><label className="form-label">Pattern name</label><input
                    type="text"
                    className="form-control"
                    value={formData.name}
                    onChange={handleChange('name')}
                  /></div><div className="mb-3"><label className="form-label">Designer name</label><input
                    type="text"
                    className="form-control"
                    value={formData.designer}
                    onChange={handleChange('designer')}
                  /></div></form></div>
        )}

        {step === 2 && (
            <div><h2>Category</h2><form><div className="mb-3"><label className="form-label">Category</label><select
                    className="form-select"
                    value={formData.category}
                    onChange={handleChange('category')}
                  ><option value="">Select a category</option>
                    {categories.map((category, index) => (
                      <option key={index}value={category}>
                        {category}
                      </option>
                    ))}
                  </select></div></form></div>
        )}

        {step === 3 && (
            <div><h2>Sizes and Audience</h2><form><div className="mb-3"><label className="form-label">Sizes</label><input
                    type="text"
                    className="form-control"
                    value={formData.sizes}
                    onChange={handleChange('sizes')}
                  /></div><div className="mb-3"><label className="form-label">Select Audience</label><select
                    className="form-select"
                    value={formData.audience}
                    onChange={handleChange('audience')}
                  ><option value="">Select an audience</option>
                    {audienceOptions.map((option, index) => (
                      <option key={index}value={option}>
                        {option}
                      </option>
                    ))}
                  </select></div></form></div>
        )}

        {step === 4 && (
            <div><h2>Sources</h2><form><div className="mb-3"><label className="form-label">When was this pattern first published?</label><div className="d-flex"><input
                      type="month"
                      className="form-control"
                      value={formData.publicationDate}
                      onChange={handleChange('publicationDate')}
                      disabled={formData.unknownDate}
                    /><div className="form-check ms-3"><input
                        type="checkbox"
                        className="form-check-input"
                        id="unknownDate"
                        checked={formData.unknownDate}
                        onChange={handleCheckboxChange('unknownDate')}
                      /><label className="form-check-label" htmlFor="unknownDate">
                        Unknown
                      </label></div></div></div><div className="mb-3"><label className="form-label">Where was this pattern published? Select all that apply.</label><div className="form-check"><input
                      type="checkbox"
                      className="form-check-input"
                      id="inPrint"
                      checked={formData.inPrint}
                      onChange={handleCheckboxChange('inPrint')}
                    /><label className="form-check-label" htmlFor="inPrint">
                      In print (book, magazine, paper)
                    </label></div><div className="form-check"><input
                      type="checkbox"
                      className="form-check-input"
                      id="onBlog"
                      checked={formData.onBlog}
                      onChange={handleCheckboxChange('onBlog')}
                    /><label className="form-check-label" htmlFor="onBlog">
                      On a blog or other website
                    </label></div></div></form></div>
        )}

        {step === 5 && (
            <div><h2>Links & Price</h2><form><div className="mb-3"><label className="form-label">Link to an outside webpage for this pattern</label><input
                    type="url"
                    className="form-control"
                    value={formData.patternLink}
                    onChange={handleChange('patternLink')}
                  /></div><div className="mb-3"><label className="form-label">Price</label><div className="form-check"><input
                      type="checkbox"
                      className="form-check-input"
                      id="isFree"
                      checked={formData.isFree}
                      onChange={handleCheckboxChange('isFree')}
                    /><label className="form-check-label" htmlFor="isFree">
                      Free
                    </label></div><div className="form-check"><input
                      type="checkbox"
                      className="form-check-input"
                      id="isPartOfBundle"
                      checked={formData.isPartOfBundle}
                      onChange={handleCheckboxChange('isPartOfBundle')}
                    /><label className="form-check-label" htmlFor="isPartOfBundle">
                      Part of a bundle
                    </label></div><div className="mb-3 mt-2"><label className="form-label">Currency</label><select
                      className="form-select"
                      value={formData.currency}
                      onChange={handleChange('currency')}
                      disabled={formData.isFree}
                    ><option value="">Select a currency</option>
                      {currencies.map((currency, index) => (
                        <option key={index}value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select></div><div className="mb-3"><input
                      type="number"
                      className="form-control"
                      placeholder="Enter a price (example: 7.50)"
                      value={formData.price}
                      onChange={handleChange('price')}
                      disabled={formData.isFree}
                    /></div></div></form></div>
        )}

        {step === 6 && (
            <div><h2>Fabric and Notions</h2><form><div className="mb-3"><label className="form-label">Fabric Type</label><div className="form-check"><input
                      type="checkbox"
                      className="form-check-input"
                      id="knit"
                      checked={formData.knit}
                      onChange={handleCheckboxChange('knit')}
                    /><label className="form-check-label" htmlFor="knit">
                      Knit
                    </label></div><div className="form-check"><input
                      type="checkbox"
                      className="form-check-input"
                      id="woven"
                      checked={formData.woven}
                      onChange={handleCheckboxChange('woven')}
                    /><label className="form-check-label" htmlFor="woven">
                      Woven
                    </label></div></div><div className="mb-3"><label className="form-label">Suggested Fabrics</label>
                  {formData.suggestedFabrics.map((fabric, index) => (
                    <div key={index}className="d-flex align-items-center mb-2"><input
                        type="text"
                        className="form-control"
                        value={fabric}
                        onChange={handleArrayChange('suggestedFabrics', index)}
                      /></div>
                  ))}
                  <button type="button"className="btn btn-link"onClick={addArrayField('suggestedFabrics')}>
                    + add suggested fabric
                  </button></div><div className="mb-3"><label className="form-label">Required Notions</label>
                  {formData.requiredNotions.map((notion, index) => (
                    <div key={index}className="d-flex align-items-center mb-2"><input
                        type="text"
                        className="form-control"
                        value={notion}
                        onChange={handleArrayChange('requiredNotions', index)}
                      /></div>
                  ))}
                  <button type="button"className="btn btn-link"onClick={addArrayField('requiredNotions')}>
                    + add notion
                  </button></div><div className="mb-3"><label className="form-label">Total Yardage</label><select
                    className="form-select"
                    value={formData.yardage}
                    onChange={handleChange('yardage')}
                  ><option value="">Select yardage</option>
                    {yardageOptions.map((option, index) => (
                      <option key={index}value={option}>
                        {option}
                      </option>
                    ))}
                  </select></div></form></div>
        )}

        {step === 7 && (
            <div><h2>Thank you for your contribution!</h2><p>We appreciate your input. Your submission will help expand our pattern database for the community.</p></div>
        )}

        <div className="d-flex justify-content-between mt-4">
            {/* Hide Back button on step 1 */}
            {step > 1 && step < 7 && (
              <button type="button"className="btn btn-secondary"onClick={prevStep}
              >
                Back
              </button>
            )}
            {/* Replace Next button with Submit on the last step */}
            {step < 6 ? (
              <button type="button"className="btn btn-primary"onClick={nextStep}
              >
                Next
              </button>
            ) : (
              step === 6 && (
                <button type="button"className="btn btn-success"onClick={handleSubmit}
                >
                  Submit
                </button>
              )
            )}
          </div></div></div></div>
  );
};

export default Contribute;
