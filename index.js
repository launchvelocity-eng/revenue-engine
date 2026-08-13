fetch('https://revenue-engine-dc8d.onrender.com/api/waitlist', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ email: userEmail })
})
.then(response => response.json())
.then(data => {
  console.log('Success:', data);
  // Show success message to the user
})
.catch((error) => {
  console.error('Error:', error);
});
