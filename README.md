# AI vs. Dot-Com Comparison

This repository contains tools and dashboards to compare the current AI boom with the Dot-com bubble, using macroeconomic data and company metrics.

## Structure

- **`macrodata-frontend.py`**: A Streamlit dashboard visualizing macroeconomic trends (Inflation, Unemployment, GDP, NASDAQ).
- **`bubble_comparison.py`**: A Python script generating static plots comparing market metrics (Valuation/Revenue, Market Cap) between the Dot-com era and the current AI era.
- **`frontend/`**: A web-based dashboard (React) visualizing the comparison data.

## Prerequisites

- **Python 3.8+**
- **pip** (Python package manager)

## Setup

1.  **Clone the repository** (if you haven't already):
    ```bash
    git clone <repository-url>
    cd ai-vs-dot-com
    ```

2.  **Install Python dependencies**:
    It is recommended to use a virtual environment.
    ```bash
    python3 -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    pip install -r requirements.txt
    ```

## Running the Code

### 1. Macro Data Dashboard (Streamlit)

This dashboard visualizes macroeconomic indicators from `data/combined-macrodata.csv`.

```bash
streamlit run macrodata-frontend.py
```
The app will open in your default web browser (usually at `http://localhost:8501`).

### 2. Web Frontend (React)

The frontend is a static React application located in the `frontend/` directory. To run it locally without CORS issues, use a simple HTTP server.

**Using Python:**
```bash
cd frontend
python3 -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

**Using Node.js (npx):**
```bash
cd frontend
npx serve .
```

### 3. Bubble Comparison Script

To run the static analysis script:

```bash
python bubble_comparison.py
```

The script is configured to read the data files from the `frontend/` directory (`Dotcom.csv`, `PureAI.xlsx`, `HighTech.xlsx`).

