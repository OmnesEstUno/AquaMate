
function compatability_filter(searchResults, addedObjects) {
    searchResults.forEach(result => {
        // Check if the result exists in the addedObjects list
        if (addedObjects.includes(
            results.saltOrFresh === "F" && addedObjects.saltOrFresh === "S") ||
            (results.saltOrFresh === "S" && addedObjects.saltOrFresh === "F") ||
            (addedObjects.aggressive.contains(result.commonName))) {
            // Apply CSS class to grey out the result
            result.element.style.color = 'grey';
            // Make the greyed-out object unclickable
            result.element.classList.add('unclickable');
        } else {
            // Make the non-greyed-out object clickable
            result.element.classList.remove('unclickable');
        }
        // Add event listener to handle clicks
        result.element.addEventListener('click', () => {
            // Only perform action if the element is clickable
            if (!result.element.classList.contains('unclickable')) {
                // Handle click event
                // Example: window.location.href = result.link; // Redirect to result link
                console.log('Clicked on:', result);
            }
        });
    });
}

