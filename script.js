document.getElementById('dataForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const spinner = document.getElementById('spinner');
    const resultsElement = document.getElementById('results');

    // Show spinner
    spinner.style.display = 'block';

    const address = document.getElementById('address').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    try {
        const response = await fetch('/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ address, startDate, endDate})
        });
        const data = await response.json();

        // Hide spinner
        spinner.style.display = 'none';

        // Show results
        resultsElement.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        console.error('Error:', error);

        // Hide spinner in case of error
        spinner.style.display = 'none';
    }
});
