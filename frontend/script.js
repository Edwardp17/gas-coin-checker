document.getElementById('inputForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const userInput = document.getElementById('coinInput').value;

    fetch('/process', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: userInput }),
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('output').textContent = data.output;
    })
    .catch((error) => {
        console.error('Error:', error);
    });
});
