"""Run the compatible backend with only the marked local demo database selected."""
import argparse
import os

from scripts.local_database import confirmed_engine, demo_database_name


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", required=True, choices=["isolated-demo"])
    parser.add_argument("--port", type=int, default=8000)
    arguments = parser.parse_args()
    try:
        engine = confirmed_engine(demo_name=demo_database_name())
        url = engine.url.render_as_string(hide_password=False)
        engine.dispose()
        os.environ["DATABASE_URL"] = url
        import uvicorn
        uvicorn.run("main:app", host="127.0.0.1", port=arguments.port, access_log=False)
        return 0
    except Exception as error:
        print(f"Demo server could not start ({type(error).__name__}); details omitted.")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
