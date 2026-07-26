from __future__ import annotations

import functools
import inspect
import logging
import time
from typing import Any, Callable, Iterable


def configure_logging(level: str = "INFO") -> None:
    resolved_level = getattr(logging, str(level or "INFO").upper(), logging.INFO)
    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        "%Y-%m-%d %H:%M:%S",
    )

    root_logger = logging.getLogger()
    if not root_logger.handlers:
        logging.basicConfig(level=resolved_level, format=formatter._fmt, datefmt=formatter.datefmt)
    else:
        root_logger.setLevel(resolved_level)
        for handler in root_logger.handlers:
            handler.setLevel(resolved_level)
            handler.setFormatter(formatter)

    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logging.getLogger(logger_name).setLevel(resolved_level)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


def _format_context(context: dict[str, Any]) -> str:
    visible_items = []
    for key, value in context.items():
        if value is None:
            continue
        visible_items.append(f"{key}={value}")
    return " | ".join(visible_items)


def log_step(logger: logging.Logger, step: str, **context: Any) -> None:
    context_text = _format_context(context)
    if context_text:
        logger.info("STEP %s | %s", step, context_text)
    else:
        logger.info("STEP %s", step)


def _should_skip_function(name: str, obj: Any, exclude_names: set[str], module_name: str | None) -> bool:
    if name in exclude_names or name.startswith("__"):
        return True
    if getattr(obj, "_cortex_logged", False):
        return True
    if module_name and getattr(obj, "__module__", None) != module_name:
        return True
    return False


def _wrap_function(func: Callable[..., Any], logger: logging.Logger) -> Callable[..., Any]:
    if getattr(func, "_cortex_logged", False):
        return func

    qualname = getattr(func, "__qualname__", getattr(func, "__name__", "unknown"))
    is_async = inspect.iscoroutinefunction(func)

    if is_async:

        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            started = time.perf_counter()
            logger.info("ENTER %s", qualname)
            try:
                result = await func(*args, **kwargs)
                duration_ms = (time.perf_counter() - started) * 1000
                logger.info("EXIT %s | duration_ms=%.2f", qualname, duration_ms)
                return result
            except Exception:
                duration_ms = (time.perf_counter() - started) * 1000
                logger.exception("ERROR %s | duration_ms=%.2f", qualname, duration_ms)
                raise

        async_wrapper._cortex_logged = True  # type: ignore[attr-defined]
        return async_wrapper

    @functools.wraps(func)
    def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
        started = time.perf_counter()
        logger.info("ENTER %s", qualname)
        try:
            result = func(*args, **kwargs)
            duration_ms = (time.perf_counter() - started) * 1000
            logger.info("EXIT %s | duration_ms=%.2f", qualname, duration_ms)
            return result
        except Exception:
            duration_ms = (time.perf_counter() - started) * 1000
            logger.exception("ERROR %s | duration_ms=%.2f", qualname, duration_ms)
            raise

    sync_wrapper._cortex_logged = True  # type: ignore[attr-defined]
    return sync_wrapper


def instrument_module_functions(
    namespace: dict[str, Any],
    logger: logging.Logger,
    exclude_names: Iterable[str] | None = None,
) -> None:
    exclude = set(exclude_names or [])
    module_name = namespace.get("__name__")

    for name, obj in list(namespace.items()):
        if not inspect.isfunction(obj):
            continue
        if _should_skip_function(name, obj, exclude, module_name):
            continue
        namespace[name] = _wrap_function(obj, logger)


def instrument_class_methods(
    cls: type[Any],
    logger: logging.Logger,
    exclude_names: Iterable[str] | None = None,
) -> None:
    exclude = set(exclude_names or [])
    for name, obj in list(vars(cls).items()):
        if name in exclude or name.startswith("__"):
            continue

        if isinstance(obj, staticmethod):
            wrapped = _wrap_function(obj.__func__, logger)
            setattr(cls, name, staticmethod(wrapped))
        elif isinstance(obj, classmethod):
            wrapped = _wrap_function(obj.__func__, logger)
            setattr(cls, name, classmethod(wrapped))
        elif inspect.isfunction(obj):
            setattr(cls, name, _wrap_function(obj, logger))


def instrument_fastapi_router(router: Any, logger: logging.Logger) -> None:
    try:
        from fastapi.routing import APIRoute
    except Exception:
        return

    for route in router.routes:
        if not isinstance(route, APIRoute):
            continue

        endpoint = route.endpoint
        if getattr(endpoint, "_cortex_logged", False):
            continue

        wrapped = _wrap_function(endpoint, logger)
        route.endpoint = wrapped
        route.dependant.call = wrapped
        route.app = route.get_route_handler()
