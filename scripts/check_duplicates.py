import pandas as pd
import requests
import io
import csv
from collections import defaultdict

def check_designer_duplicates():
    """
    Fetches the Designer CSV and checks for duplicate name and URL.
    """
    csv_url = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Designer-urCFmZgMvhZPbclOCq6asyNa0OQwdU.csv"
    new_name = "Wildflower Design"
    new_url = "https://www.wildflowerdesignpatterns.com/"

    print(f"Fetching data from {csv_url}...")
    try:
        response = requests.get(csv_url)
        response.raise_for_status()
        
        df = pd.read_csv(io.StringIO(response.text))
        
        print("\n--- Analysis Results ---")
        
        # Check for duplicate name
        name_exists = df['name'].str.lower().eq(new_name.lower()).any()
        if name_exists:
            print(f"❌ Name Check: The name '{new_name}' was found in the data.")
        else:
            print(f"✅ Name Check: The name '{new_name}' is unique.")
            
        # Check for duplicate URL
        url_exists = df['url'].str.lower().eq(new_url.lower()).any()
        if url_exists:
            print(f"❌ URL Check: The URL '{new_url}' was found in the data.")
        else:
            print(f"✅ URL Check: The URL '{new_url}' is unique.")
        
        print("------------------------\n")

        if not name_exists and not url_exists:
            print("Conclusion: Neither the name nor the URL are duplicates in the provided data.")
            print("This suggests the unique constraint might be on another field or there's a data issue in the live database not reflected in the CSV.")
        else:
            print("Conclusion: A duplicate value was found.")

    except Exception as e:
        print(f"An error occurred: {e}")

def check_duplicates(file_path, column_name):
    """
    Checks for duplicate values in a specified column of a CSV file.

    Args:
        file_path (str): The path to the CSV file.
        column_name (str): The name of the column to check for duplicates.

    Returns:
        dict: A dictionary where keys are duplicate values and values are lists of row numbers
              where these duplicates appear. Returns an empty dictionary if no duplicates.
    """
    duplicates = defaultdict(list)
    with open(file_path, 'r', newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        
        if column_name not in reader.fieldnames:
            print(f"Error: Column '{column_name}' not found in the CSV file.")
            return {}

        for row_num, row in enumerate(reader, start=2):  # start=2 for 1-based indexing + header
            value = row[column_name]
            if value:  # Only consider non-empty values
                duplicates[value].append(row_num)
    
    # Filter out values that are not duplicates (i.e., appear only once)
    return {value: rows for value, rows in duplicates.items() if len(rows) > 1}

if __name__ == "__main__":
    # Example usage:
    csv_file = 'your_data.csv'  # Replace with your CSV file path
    column_to_check = 'email'   # Replace with the column you want to check

    # Create a dummy CSV file for demonstration
    with open(csv_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['id', 'name', 'email'])
        writer.writerow(['1', 'Alice', 'alice@example.com'])
        writer.writerow(['2', 'Bob', 'bob@example.com'])
        writer.writerow(['3', 'Charlie', 'alice@example.com'])
        writer.writerow(['4', 'David', 'david@example.com'])
        writer.writerow(['5', 'Eve', 'bob@example.com'])

    found_duplicates = check_duplicates(csv_file, column_to_check)

    if found_duplicates:
        print(f"Duplicates found in column '{column_to_check}':")
        for value, rows in found_duplicates.items():
            print(f"  Value: '{value}' found in rows: {', '.join(map(str, rows))}")
    else:
        print(f"No duplicates found in column '{column_to_check}'.")

    check_designer_duplicates()
